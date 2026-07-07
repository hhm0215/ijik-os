import { desc } from "drizzle-orm";
import { db, jobPostings } from "@/db";

export async function GET() {
  const postings = db
    .select()
    .from(jobPostings)
    .orderBy(desc(jobPostings.collectedAt))
    .all();
  return Response.json(postings);
}

export async function POST(request: Request) {
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
      rawText: body.rawText,
      url: body.url ?? "",
      source: "manual",
    })
    .returning()
    .get();
  return Response.json(posting, { status: 201 });
}
