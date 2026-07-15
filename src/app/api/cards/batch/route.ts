import { db, experienceCards } from "@/db";
import { ownerRoute } from "@/lib/auth-session";
import { cardBatchSchema } from "@/lib/card-import-policy";

export const POST = ownerRoute(async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 });
  }

  const parsed = cardBatchSchema.safeParse(body);
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
});
