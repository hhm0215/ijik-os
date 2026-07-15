import { and, eq } from "drizzle-orm";
import { db, jobPostings } from "@/db";
import { userRoute } from "@/lib/auth-session";
import { runPipeline } from "@/lib/pipeline/run";

export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export const POST = userRoute(async (_request: Request, { params }: Ctx, session) => {
  const { id } = await params;
  const postingId = Number(id);
  const posting = db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(
      and(
        eq(jobPostings.id, postingId),
        eq(jobPostings.userId, session.user.id)
      )
    )
    .get();
  if (!posting) {
    return Response.json({ error: "공고 없음" }, { status: 404 });
  }

  try {
    await runPipeline(postingId, session.user.id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
});
