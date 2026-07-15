import { and, asc, eq, inArray } from "drizzle-orm";
import {
  askbacks,
  db,
  drafts,
  draftSentences,
  draftSentenceSources,
  experienceCards,
  interviewAnswerPoints,
  interviewQuestions,
  jobPostings,
  matches,
  requirements,
} from "@/db";
import { userRoute } from "@/lib/auth-session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = userRoute(async (_request: Request, { params }: Ctx, session) => {
  const { id } = await params;
  const postingId = Number(id);
  const posting = db
    .select()
    .from(jobPostings)
    .where(
      and(
        eq(jobPostings.id, postingId),
        eq(jobPostings.userId, session.user.id)
      )
    )
    .get();
  if (!posting) return Response.json({ error: "공고 없음" }, { status: 404 });

  const cards = db
    .select()
    .from(experienceCards)
    .where(eq(experienceCards.userId, session.user.id))
    .all();
  const cardTitle = new Map(cards.map((c) => [c.id, c.title]));

  const reqRows = db
    .select()
    .from(requirements)
    .where(
      and(
        eq(requirements.userId, session.user.id),
        eq(requirements.jobPostingId, postingId)
      )
    )
    .all();
  const reqIds = reqRows.map((r) => r.id);
  const matchRows = reqIds.length
    ? db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.userId, session.user.id),
            inArray(matches.requirementId, reqIds)
          )
        )
        .all()
    : [];

  const draftRows = db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.userId, session.user.id),
        eq(drafts.jobPostingId, postingId)
      )
    )
    .all();
  const draftIds = draftRows.map((d) => d.id);
  const sentenceRows = draftIds.length
    ? db
        .select()
        .from(draftSentences)
        .where(
          and(
            eq(draftSentences.userId, session.user.id),
            inArray(draftSentences.draftId, draftIds)
          )
        )
        .orderBy(asc(draftSentences.orderIdx))
        .all()
    : [];
  const sentenceIds = sentenceRows.map((s) => s.id);
  const extraSources = sentenceIds.length
    ? db
        .select()
        .from(draftSentenceSources)
        .where(
          and(
            eq(draftSentenceSources.userId, session.user.id),
            inArray(draftSentenceSources.sentenceId, sentenceIds)
          )
        )
        .all()
    : [];

  const askbackRows = db
    .select()
    .from(askbacks)
    .where(
      and(
        eq(askbacks.userId, session.user.id),
        eq(askbacks.jobPostingId, postingId)
      )
    )
    .all();

  const questionRows = db
    .select()
    .from(interviewQuestions)
    .where(
      and(
        eq(interviewQuestions.userId, session.user.id),
        eq(interviewQuestions.jobPostingId, postingId)
      )
    )
    .orderBy(asc(interviewQuestions.orderIdx))
    .all();
  const questionIds = questionRows.map((q) => q.id);
  const answerPointRows = questionIds.length
    ? db
        .select()
        .from(interviewAnswerPoints)
        .where(
          and(
            eq(interviewAnswerPoints.userId, session.user.id),
            inArray(interviewAnswerPoints.questionId, questionIds)
          )
        )
        .orderBy(asc(interviewAnswerPoints.orderIdx))
        .all()
    : [];

  return Response.json({
    posting,
    requirements: reqRows.map((r) => ({
      ...r,
      matches: matchRows
        .filter((m) => m.requirementId === r.id)
        .map((m) => ({ ...m, cardTitle: cardTitle.get(m.cardId) ?? `#${m.cardId}` })),
    })),
    drafts: draftRows.map((d) => ({
      ...d,
      sentences: sentenceRows
        .filter((s) => s.draftId === d.id)
        .map((s) => ({
          ...s,
          primarySourceTitle: s.primarySourceCardId
            ? (cardTitle.get(s.primarySourceCardId) ?? `#${s.primarySourceCardId}`)
            : null,
          additionalSources: extraSources
            .filter((x) => x.sentenceId === s.id)
            .map((x) => ({
              cardId: x.cardId,
              title: cardTitle.get(x.cardId) ?? `#${x.cardId}`,
            })),
        })),
    })),
    askbacks: askbackRows.map((a) => ({
      ...a,
      requirementText:
        reqRows.find((r) => r.id === a.requirementId)?.text ?? null,
    })),
    interview: questionRows.map((q) => ({
      ...q,
      answerPoints: answerPointRows
        .filter((p) => p.questionId === q.id)
        .map((p) => ({
          ...p,
          sourceTitle: p.primarySourceCardId
            ? (cardTitle.get(p.primarySourceCardId) ?? `#${p.primarySourceCardId}`)
            : null,
        })),
    })),
  });
});

export const PATCH = userRoute(async (request: Request, { params }: Ctx, session) => {
  const { id } = await params;
  const body = await request.json();
  const allowed = ["new", "reviewing", "applied", "skipped"];
  if (!allowed.includes(body.pipelineStatus)) {
    return Response.json({ error: "잘못된 상태" }, { status: 400 });
  }
  const posting = db
    .update(jobPostings)
    .set({ pipelineStatus: body.pipelineStatus })
    .where(
      and(
        eq(jobPostings.id, Number(id)),
        eq(jobPostings.userId, session.user.id)
      )
    )
    .returning()
    .get();
  if (!posting) return Response.json({ error: "공고 없음" }, { status: 404 });
  return Response.json(posting);
});
