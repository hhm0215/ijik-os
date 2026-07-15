import { z } from "zod";
import { db, experienceCards } from "@/db";

const cardSchema = z.object({
  title: z.string().trim().min(1),
  situation: z.string().trim().min(1),
  role: z.string().trim().min(1),
  action: z.string().trim().min(1),
  resultMetrics: z.string().trim().default(""),
  learned: z.string().trim().default(""),
  evidenceSentence: z.string().trim().default(""),
  claimable: z.string().trim().default(""),
  notClaimable: z.string().trim().default(""),
  tags: z.string().trim().default(""),
});

const batchSchema = z.object({
  cards: z.array(cardSchema).min(1).max(12),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "카드는 1~12개이며 제목·상황·내 역할·행동이 모두 필요합니다." },
      { status: 400 }
    );
  }

  const cards = db.transaction((tx) =>
    parsed.data.cards.map((card) =>
      tx.insert(experienceCards).values(card).returning().get()
    )
  );

  return Response.json({ cards }, { status: 201 });
}
