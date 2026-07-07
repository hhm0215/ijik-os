import { eq } from "drizzle-orm";
import { db, draftSentences, experienceCards } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const card = db
    .select()
    .from(experienceCards)
    .where(eq(experienceCards.id, Number(id)))
    .get();
  if (!card) return Response.json({ error: "카드 없음" }, { status: 404 });
  return Response.json(card);
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const cardId = Number(id);
  const body = await request.json();
  const card = db
    .update(experienceCards)
    .set({
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
      updatedAt: new Date().toISOString(),
    })
    .where(eq(experienceCards.id, cardId))
    .returning()
    .get();
  if (!card) return Response.json({ error: "카드 없음" }, { status: 404 });

  // 카드 변경 정책: 이 카드를 출처로 가진 초안 문장에 "출처 변경됨" 표시
  db.update(draftSentences)
    .set({ sourceChanged: true })
    .where(eq(draftSentences.primarySourceCardId, cardId))
    .run();

  return Response.json(card);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  // hard delete 금지 — 초안이 출처로 참조하므로 보관 처리만
  const card = db
    .update(experienceCards)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(experienceCards.id, Number(id)))
    .returning()
    .get();
  if (!card) return Response.json({ error: "카드 없음" }, { status: 404 });
  return Response.json({ ok: true });
}
