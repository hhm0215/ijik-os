import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { askbacks, db, experienceCards } from "@/db";
import { userRoute } from "@/lib/auth-session";
import { generateStructured } from "@/lib/llm";

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
export const POST = userRoute(async (request: Request, { params }: Ctx, session) => {
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
    .where(
      and(
        eq(askbacks.id, askbackId),
        eq(askbacks.userId, session.user.id)
      )
    )
    .get();
  if (!askback) return Response.json({ error: "되묻기 없음" }, { status: 404 });

  let fields: z.infer<typeof cardFromAnswerSchema>;
  try {
    fields = await generateStructured({
      schema: cardFromAnswerSchema,
      maxTokens: 4000,
      system: `사용자의 답변을 경험 카드로 구조화한다. 절대 원칙: 사용자가 말한 내용만 사용하고, 말하지 않은 경험·수치·기술을 창작하지 않는다. 답변에 없는 필드는 빈 문자열로 둔다. claimable(주장해도 되는 것)은 답변에서 실제로 뒷받침되는 범위만. 모든 텍스트는 한국어. tags는 쉼표 구분.`,
      user: `## 질문\n${askback.question}\n\n## 사용자 답변\n${answer}`,
    });
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

  const { card, updated } = db.transaction((tx) => {
    const card = tx
      .insert(experienceCards)
      .values({ ...fields, userId: session.user.id })
      .returning()
      .get();
    const updated = tx
      .update(askbacks)
      .set({
        answer,
        status: "answered",
        resultCardId: card.id,
        resultType: "new_card",
      })
      .where(
        and(
          eq(askbacks.id, askbackId),
          eq(askbacks.userId, session.user.id)
        )
      )
      .returning()
      .get();
    if (!updated) throw new Error("되묻기를 갱신할 수 없습니다.");
    return { card, updated };
  });

  return Response.json({ askback: updated, card });
});
