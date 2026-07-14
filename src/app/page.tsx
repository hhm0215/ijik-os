import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, experienceCards, jobPostings } from "@/db";
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
  const cards = db
    .select()
    .from(experienceCards)
    .where(eq(experienceCards.archived, false))
    .all();
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
    <div className="space-y-6">
      <section id="how-it-works" className="rounded-md border border-neutral-200 bg-white p-5">
        <p className="mb-1 text-[12px] font-semibold text-emerald-700">이직 OS는 이렇게 써요</p>
        <h1 className="text-[18px] font-bold">내 경험으로만 지원 준비를 정리하는 도구예요.</h1>
        <p className="mt-2 max-w-3xl text-neutral-600">
          AI가 새로운 경험을 지어내지 않도록, 먼저 경험 뱅크에 내가 한 일을 기록하고 공고와 연결합니다.
          근거가 부족하면 문장을 만들지 않고 되묻는 질문을 보여줘요.
        </p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          <li className="rounded border border-neutral-200 p-3">
            <span className="text-[12px] font-bold text-emerald-700">1. 경험 기록</span>
            <p className="mt-1 font-semibold">경험 뱅크를 채워요</p>
            <p className="mt-1 text-[12px] text-neutral-500">내 역할, 행동, 결과와 말해도 되는 범위를 적어요.</p>
          </li>
          <li className="rounded border border-neutral-200 p-3">
            <span className="text-[12px] font-bold text-emerald-700">2. 공고 분석</span>
            <p className="mt-1 font-semibold">관심 공고를 붙여넣어요</p>
            <p className="mt-1 text-[12px] text-neutral-500">요구사항과 경험을 매칭해 적합도와 초안을 만들어요.</p>
          </li>
          <li className="rounded border border-neutral-200 p-3">
            <span className="text-[12px] font-bold text-emerald-700">3. 검토·보강</span>
            <p className="mt-1 font-semibold">출처와 빈칸을 확인해요</p>
            <p className="mt-1 text-[12px] text-neutral-500">근거 카드와 되묻기 답변을 보고 지원 자료를 다듬어요.</p>
          </li>
        </ol>
        {cards.length === 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded bg-emerald-50 p-3">
            <p className="text-[13px] text-emerald-950"><strong>첫 단계:</strong> 공고를 분석하기 전에 경험 카드 1장부터 만들어보세요.</p>
            <Link href="/cards/new" className="rounded bg-emerald-700 px-3 py-1.5 text-[13px] font-semibold text-white">첫 경험 카드 작성</Link>
          </div>
        )}
      </section>

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
        <PasteForm hasCards={cards.length > 0} />
      </div>
    </div>
  );
}
