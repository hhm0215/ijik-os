import { eq } from "drizzle-orm";
import { db, experienceCards } from "@/db";
import { ownerRoute } from "@/lib/auth-session";

export const GET = ownerRoute(async () => {
  const cards = db
    .select()
    .from(experienceCards)
    .where(eq(experienceCards.archived, false))
    .all();
  return Response.json(cards);
});

export const POST = ownerRoute(async (request) => {
  const body = await request.json();
  if (!body.title || !body.situation || !body.role || !body.action) {
    return Response.json(
      { error: "제목, 상황, 내 역할, 행동은 필수입니다." },
      { status: 400 }
    );
  }
  const card = db
    .insert(experienceCards)
    .values({
      title: body.title,
      situation: body.situation,
      role: body.role,
      action: body.action,
      resultMetrics: body.resultMetrics ?? "",
      learned: body.learned ?? "",
      evidenceSentence: body.evidenceSentence ?? "",
      claimable: body.claimable ?? "",
      notClaimable: body.notClaimable ?? "",
      tags: body.tags ?? "",
    })
    .returning()
    .get();
  return Response.json(card, { status: 201 });
});
