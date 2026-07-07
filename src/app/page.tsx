import { desc } from "drizzle-orm";
import Link from "next/link";
import { db, jobPostings } from "@/db";
import PasteForm from "./paste-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  new: "신규",
  reviewing: "검토 중",
  applied: "지원함",
  skipped: "스킵",
};

const ANALYSIS_LABEL: Record<string, string> = {
  pending: "분석 대기",
  running: "분석 중…",
  done: "",
  error: "분석 실패",
};

export default function Home() {
  const postings = db
    .select()
    .from(jobPostings)
    .orderBy(desc(jobPostings.collectedAt))
    .all();

  const sorted = [...postings].sort((a, b) => {
    const fa = a.fitJson ? (JSON.parse(a.fitJson).overall ?? 0) : -1;
    const fb = b.fitJson ? (JSON.parse(b.fitJson).overall ?? 0) : -1;
    return fb - fa;
  });

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <section>
        <h1 className="mb-3 font-semibold text-neutral-500">
          공고 피드 ({postings.length}) — 적합도순
        </h1>
        {sorted.length === 0 && (
          <p className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-neutral-400">
            아직 공고가 없어요. 오른쪽에 채용 공고 본문을 붙여넣으면 분석이
            시작돼요. (먼저 경험 뱅크에 카드를 1장 이상 넣어주세요)
          </p>
        )}
        <ul className="space-y-2">
          {sorted.map((p) => {
            const fit = p.fitJson ? JSON.parse(p.fitJson) : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/postings/${p.id}`}
                  className="flex items-center gap-4 rounded-md border border-neutral-200 bg-white p-4 hover:border-neutral-400"
                >
                  <div className="w-14 text-center">
                    {fit ? (
                      <>
                        <div className="text-xl font-bold">{fit.overall}</div>
                        <div className="text-[11px] text-neutral-400">적합도</div>
                      </>
                    ) : (
                      <div className="text-[11px] text-neutral-400">
                        {ANALYSIS_LABEL[p.analysisStatus] || "—"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {p.title || "(분석 후 제목이 표시돼요)"}
                    </div>
                    <div className="truncate text-neutral-500">
                      {p.company || "—"} · {STATUS_LABEL[p.pipelineStatus]}
                      {p.verdict ? ` · ${p.verdict}` : ""}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <PasteForm />
    </div>
  );
}
