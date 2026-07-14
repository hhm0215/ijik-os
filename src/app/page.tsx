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
  running: "분석 중",
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
  const currentStep = cards.length === 0 ? 1 : postings.length === 0 ? 2 : 3;

  return (
    <div className="space-y-7">
      <section id="how-it-works" className="surface relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="absolute -right-20 -top-32 size-80 rounded-full bg-[radial-gradient(circle,#d3f3e4_0%,rgba(211,243,228,0)_68%)]" />
        <div className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-[radial-gradient(circle,#ffecd0_0%,rgba(255,236,208,0)_68%)] opacity-70" />
        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dce8e1] bg-[#f8fcfa] px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-[#167b57]">
              <span className="size-1.5 rounded-full bg-[#28a274]" />
              EVIDENCE-FIRST CAREER AI
            </div>
            <h1 className="max-w-2xl text-[30px] font-black leading-[1.18] tracking-[-0.055em] text-[#15231b] sm:text-[40px]">
              내 경험에서 시작하는<br />지원 전략 워크스페이스
            </h1>
            <p className="mt-4 max-w-2xl text-[14px] leading-7 text-[#66736c] sm:text-[15px]">
              AI가 경험을 지어내지 않습니다. 내가 기록한 사실을 공고와 연결하고,
              부족한 근거는 질문으로 돌려줘요.
            </p>
            {cards.length === 0 ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/cards/new" className="rounded-xl bg-[#167b57] px-5 py-3 text-[13px] font-bold text-white shadow-[0_8px_22px_rgba(22,123,87,.22)] hover:-translate-y-0.5 hover:bg-[#0e6949]">
                  첫 경험 카드 작성하기 →
                </Link>
                <span className="text-[12px] text-[#7b8780]">가장 자신 있는 경험 하나면 충분해요</span>
              </div>
            ) : (
              <div className="mt-6 flex items-center gap-3 text-[12px] font-semibold text-[#527064]">
                <span className="rounded-lg bg-[#e9f7f0] px-3 py-2">경험 카드 {cards.length}장 준비됨</span>
                <span>이제 관심 공고를 분석해보세요.</span>
              </div>
            )}
          </div>

          <ol className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["01", "경험을 기록해요", "역할·행동·결과와 주장 범위를 남겨요."],
              ["02", "공고를 분석해요", "요구사항과 내 경험의 연결점을 찾아요."],
              ["03", "근거를 검토해요", "출처·초안·빈 경험을 한 화면에서 봐요."],
            ].map(([number, title, description], index) => {
              const active = currentStep === index + 1;
              const done = currentStep > index + 1;
              return (
                <li key={number} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${active ? "border-[#9fd7bd] bg-[#eef9f3] shadow-sm" : "border-[#e8ece9] bg-white/70"}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-black ${done ? "bg-[#167b57] text-white" : active ? "bg-white text-[#167b57] shadow-sm" : "bg-[#f1f4f2] text-[#9aa39e]"}`}>
                    {done ? "✓" : number}
                  </span>
                  <span>
                    <strong className="block text-[13px] text-[#25332b]">{title}</strong>
                    <span className="mt-0.5 block text-[11px] leading-5 text-[#7b8780]">{description}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-bold tracking-[0.09em] text-[#8a958f]">JOB PIPELINE</p>
              <h2 className="mt-1 text-[18px] font-extrabold tracking-[-0.035em]">공고 피드</h2>
            </div>
            <span className="rounded-full bg-[#f0f4f2] px-3 py-1.5 text-[11px] font-bold text-[#66736c]">{postings.length}개 · 적합도순</span>
          </div>

          {sorted.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef6f2] text-xl">◎</span>
                <h3 className="mt-4 font-bold text-[#35423b]">아직 분석한 공고가 없어요</h3>
                <p className="mt-2 text-[12px] leading-6 text-[#849089]">오른쪽에 관심 공고의 본문을 붙여넣으면<br />내 경험과의 연결점을 분석합니다.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[#edf0ee]">
              {sorted.map((p) => {
                const fit = p.fitJson ? JSON.parse(p.fitJson) : null;
                return (
                  <li key={p.id}>
                    <Link href={`/postings/${p.id}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-[#f8fbf9] sm:px-6">
                      <div className={`grid size-14 shrink-0 place-items-center rounded-2xl ${fit ? "bg-[#edf8f2] text-[#167b57]" : "bg-[#f2f4f3] text-[#8a958f]"}`}>
                        {fit ? (
                          <span className="text-center"><strong className="block text-[20px] leading-none">{fit.overall}</strong><span className="mt-1 block text-[9px] font-bold">FIT</span></span>
                        ) : (
                          <span className="text-center text-[10px] font-bold">{ANALYSIS_LABEL[p.analysisStatus] || "—"}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-bold text-[#26332c] group-hover:text-[#126a4a]">{p.title || "분석 후 제목이 표시돼요"}</div>
                        <div className="mt-1 truncate text-[12px] text-[#7c8881]">{p.company || "회사 미확인"} · {STATUS_LABEL[p.pipelineStatus]}{p.verdict ? ` · ${p.verdict}` : ""}</div>
                      </div>
                      <span className="text-lg text-[#b0bab4] group-hover:translate-x-1 group-hover:text-[#167b57]">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <PasteForm hasCards={cards.length > 0} />
      </div>
    </div>
  );
}
