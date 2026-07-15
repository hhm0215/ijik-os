import { desc, eq } from "drizzle-orm";
import { db, jobPostings } from "@/db";
import { userRoute } from "@/lib/auth-session";

export const GET = userRoute(async (_request, _context, session) => {
  const postings = db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.userId, session.user.id))
    .orderBy(desc(jobPostings.collectedAt))
    .all();
  return Response.json(postings);
});

export const POST = userRoute(async (request, _context, session) => {
  const body = await request.json();
  if (!body.rawText || body.rawText.trim().length < 50) {
    return Response.json(
      { error: "공고 본문을 붙여넣어 주세요 (최소 50자)." },
      { status: 400 }
    );
  }
  const posting = db
    .insert(jobPostings)
    .values({
      userId: session.user.id,
      rawText: body.rawText,
      url: body.url ?? "",
      source: "manual",
    })
    .returning()
    .get();
  return Response.json(posting, { status: 201 });
});
