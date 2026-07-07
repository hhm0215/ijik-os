import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { askbacks, db, experienceCards } from "@/db";
import { getClient, MODEL } from "@/lib/anthropic";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const cardFromAnswerSchema = z.object({
  title: z.string(),
  situation: z.string(),
  role: z.string(),
  action: z.string(),
  resultMetrics: z.string(),
  learned: z.string(),
  evidenceSentence: z.string(),
  claimable: z.string(),
  notClaimable: z.string(),
  tags: z.string(),
});

// 되묻기 답변 → 새 경험 카드로 저장 (AI는 사용자의 답변을 구조화만 한다)
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const askbackId = Number(id);
  const body = await request.json();
  const answer: string = (body.answer ?? "").trim();
  if (!answer) {
    return Response.json({ error: "답변을 입력해주세요." }, { status: 400 });
  }

  const askback = db
    .select()
    .from(askbacks)
    .where(eq(askbacks.id, askbackId))
    .get();
  if (!askback) return Response.json({ error: "되묻기 없음" }, { status: 404 });

  let fields: z.infer<typeof cardFromAnswerSchema>;
  try {
    const client = getClient();
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: `사용자의 답변을 경험 카드로 구조화한다. 절대 원칙: 사용자가 말한 내용만 사용하고, 말하지 않은 경험·수치·기술을 창작하지 않는다. 답변에 없는 필드는 빈 문자열로 둔다. claimable(주장해도 되는 것)은 답변에서 실제로 뒷받침되는 범위만. 모든 텍스트는 한국어. tags는 쉼표 구분.`,
      messages: [
        {
          role: "user",
          content: `## 질문\n${askback.question}\n\n## 사용자 답변\n${answer}`,
        },
      ],
      output_config: { format: zodOutputFormat(cardFromAnswerSchema) },
    });
    if (!res.parsed_output) throw new Error("파싱 실패");
    fields = res.parsed_output;
  } catch {
    // LLM 실패 시에도 답변은 잃지 않는다 — 원문 그대로 카드로 저장
    fields = {
      title: askback.question.slice(0, 40),
      situation: answer,
      role: "",
      action: "",
      resultMetrics: "",
      learned: "",
      evidenceSentence: "",
      claimable: "",
      notClaimable: "",
      tags: "",
    };
  }

  const card = db.insert(experienceCards).values(fields).returning().get();
  const updated = db
    .update(askbacks)
    .set({
      answer,
      status: "answered",
      resultCardId: card.id,
      resultType: "new_card",
    })
    .where(eq(askbacks.id, askbackId))
    .returning()
    .get();

  return Response.json({ askback: updated, card });
}
