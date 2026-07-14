"use client";

import { useCallback, useEffect, useState } from "react";

type Detail = {
  posting: {
    id: number;
    title: string;
    company: string;
    source: string;
    url: string;
    pipelineStatus: string;
    analysisStatus: string;
    analysisError: string | null;
    fitJson: string | null;
    verdict: string | null;
    collectedAt: string;
  };
  requirements: {
    id: number;
    category: string;
    text: string;
    matches: {
      id: number;
      cardId: number;
      cardTitle: string;
      strength: string;
      rationale: string;
    }[];
  }[];
  drafts: {
    id: number;
    kind: string;
    sentences: {
      id: number;
      text: string;
      type: string;
      warning: string | null;
      primarySourceCardId: number | null;
      primarySourceTitle: string | null;
      additionalSources: { cardId: number; title: string }[];
      sourceChanged: boolean;
    }[];
  }[];
  askbacks: {
    id: number;
    question: string;
    why: string;
    answer: string | null;
    status: string;
    requirementText: string | null;
    resultCardId: number | null;
  }[];
  interview: {
    id: number;
    question: string;
    qtype: string;
    answerPoints: {
      id: number;
      text: string;
      type: string;
      primarySourceCardId: number | null;
      sourceTitle: string | null;
    }[];
  }[];
};

const CAT_LABEL: Record<string, string> = {
  tech: "기술",
  domain: "도메인",
  collab: "협업",
  impact: "성과",
};
const STRENGTH_LABEL: Record<string, string> = {
  strong: "강",
  medium: "중",
  weak: "약",
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#dfe7e2] bg-[#f5f8f6] px-2.5 py-1 text-[10px] font-semibold text-[#627068]">
      {children}
    </span>
  );
}

export default function PostingDetail({ postingId }: { postingId: number }) {
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"intro" | "resume" | "interview">("intro");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/postings/${postingId}`);
    if (res.ok) setData(await res.json());
    else setError("공고를 불러오지 못했어요");
  }, [postingId]);

  useEffect(() => {
    // 초기 요청도 effect 본문이 아닌 비동기 작업으로 예약한다. 최신 React lint는
    // effect에서 동기적으로 상태를 갱신하는 패턴을 금지한다.
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  // 분석 중이면 5초마다 폴링
  const analysisStatus = data?.posting.analysisStatus;
  useEffect(() => {
    if (analysisStatus === "pending" || analysisStatus === "running") {
      const t = setInterval(load, 5000);
      return () => clearInterval(t);
    }
  }, [analysisStatus, load]);

  async function retryAnalyze() {
    setData((d) =>
      d
        ? { ...d, posting: { ...d.posting, analysisStatus: "running", analysisError: null } }
        : d
    );
    fetch(`/api/postings/${postingId}/analyze`, { method: "POST" })
      .catch(() => {})
      .finally(load);
  }

  async function setStatus(pipelineStatus: string) {
    await fetch(`/api/postings/${postingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStatus }),
    });
    load();
  }

  if (error) return <p className="surface mx-auto max-w-xl border-red-200 p-6 text-center text-red-700">{error}</p>;
  if (!data) return <div className="surface mx-auto max-w-xl p-10 text-center"><span className="soft-pulse text-[13px] font-semibold text-[#738078]">분석 결과를 불러오는 중…</span></div>;

  const { posting } = data;
  const fit = posting.fitJson ? JSON.parse(posting.fitJson) : null;

  if (posting.analysisStatus !== "done") {
    return (
      <div className="surface mx-auto mt-10 max-w-xl overflow-hidden p-9 text-center sm:p-12">
        {posting.analysisStatus === "error" ? (
          <>
            <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-red-50 text-2xl">!</span>
            <p className="mb-2 text-[18px] font-extrabold text-red-700">분석을 완료하지 못했어요</p>
            <p className="mb-6 text-[12px] leading-6 text-[#758179]">{posting.analysisError}</p>
            <button
              onClick={retryAnalyze}
              className="rounded-xl bg-[#172d22] px-6 py-3 text-[13px] font-bold text-white hover:bg-[#167b57]"
            >
              다시 분석
            </button>
          </>
        ) : (
          <>
            <span className="soft-pulse mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[#edf8f2] text-xl text-[#167b57]">✦</span>
            <p className="mb-3 text-[18px] font-extrabold tracking-[-0.03em]">
              공고를 분석하는 중이에요…
            </p>
            <p className="mx-auto max-w-md text-[12px] leading-6 text-[#758179]">
              요구사항 분해 → 경험 카드 매칭 → 초안 생성 → 정합성 검증. 보통
              몇 분 걸릴 수 있어요. 이 페이지는 자동으로 갱신됩니다.
            </p>
            {posting.analysisStatus === "pending" && (
              <button
                onClick={retryAnalyze}
                className="mt-5 rounded-xl border border-[#dce3df] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#647169] hover:border-[#9bcbb5] hover:text-[#167b57]"
              >
                분석이 시작되지 않았다면 여기를 눌러주세요
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const intro = data.drafts.find((d) => d.kind === "intro");
  const resume = data.drafts.find((d) => d.kind === "resume_points");
  const openAskbacks = data.askbacks.filter((a) => a.status === "open");
  const answeredAskbacks = data.askbacks.filter((a) => a.status !== "open");

  return (
    <div className="space-y-6">
      <header className="surface flex flex-col justify-between gap-5 overflow-hidden p-6 sm:flex-row sm:items-center sm:p-7">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-[0.1em] text-[#167b57]"><span className="size-1.5 rounded-full bg-[#28a274]" />ANALYSIS COMPLETE</div>
          <h1 className="truncate text-[23px] font-black tracking-[-0.045em]">
            {posting.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#748078]">
            <span>{posting.company}</span><span className="text-[#c5ccc8]">/</span><span>공고 #{posting.id}</span>
        {posting.url && (
          <a
            href={posting.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#f0f5f2] px-2.5 py-1 text-[10px] font-bold text-[#4d685a] hover:bg-[#e1f2e9] hover:text-[#167b57]"
          >
            원문 보기 ↗
          </a>
        )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setStatus("applied")}
            disabled={posting.pipelineStatus === "applied"}
            className="rounded-xl bg-[#167b57] px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_6px_16px_rgba(22,123,87,.18)] hover:bg-[#0e6949] disabled:opacity-45"
          >
            {posting.pipelineStatus === "applied" ? "지원함 ✓" : "지원함으로 표시"}
          </button>
          <button
            onClick={() => setStatus("skipped")}
            disabled={posting.pipelineStatus === "skipped"}
            className="rounded-xl border border-[#dce3df] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#6f7b74] hover:bg-[#f4f6f5] disabled:opacity-45"
          >
            {posting.pipelineStatus === "skipped" ? "스킵됨" : "스킵"}
          </button>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,.9fr)_minmax(420px,1.65fr)] 2xl:grid-cols-[minmax(260px,.85fr)_minmax(460px,1.55fr)_minmax(290px,.9fr)]">
        {/* 왼쪽: 요구사항 분해 + 매칭 */}
        <section className="surface overflow-hidden">
          <div className="border-b border-[#edf0ee] px-5 py-4"><p className="text-[10px] font-black tracking-[0.1em] text-[#8c9790]">EVIDENCE MAP</p><h2 className="mt-1 text-[15px] font-extrabold">요구사항과 경험</h2></div>
          <ul className="space-y-2.5 p-4">
            {data.requirements.map((r) => (
              <li key={r.id} className="rounded-2xl border border-[#e5eae7] bg-[#fbfcfb] p-3.5">
                <div className="mb-2 leading-5">
                  <Chip>{CAT_LABEL[r.category] ?? r.category}</Chip>{" "}
                  <span className="ml-1 text-[12px] font-bold text-[#37443d]">{r.text}</span>
                </div>
                {r.matches.length > 0 ? (
                  r.matches.map((m) => (
                    <div
                      key={m.id}
                      className="mt-1.5 rounded-xl bg-[#eaf7f0] px-3 py-2 text-[11px] font-semibold leading-5 text-[#176848]"
                    >
                      ✓ ({STRENGTH_LABEL[m.strength]}) {m.cardTitle}{" "}
                      <Chip>카드 #{m.cardId}</Chip>
                    </div>
                  ))
                ) : (
                  <div className="mt-1.5 rounded-xl border border-dashed border-[#e8c8a0] bg-[#fff8eb] px-3 py-2 text-[11px] leading-5 text-[#87602b]">
                    근거 없음 · 되묻기 생성
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 가운데: 적합도 + 초안 */}
        <section className="surface overflow-hidden">
          {fit && (
            <div className="border-b border-[#edf0ee] bg-[linear-gradient(135deg,#f5fbf8,#fffaf2)] p-5">
              <div className="grid grid-cols-4 gap-2.5">
                {(["tech", "domain", "collab", "impact"] as const).map((k) => (
                  <div
                    key={k}
                    className="rounded-2xl border border-white/80 bg-white/85 p-3 text-center shadow-sm"
                  >
                    <div
                      className={`text-[20px] font-black tracking-[-0.04em] ${fit[k] < 50 ? "text-[#d25d51]" : "text-[#167b57]"}`}
                    >
                      {fit[k]}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-[#849088]">
                      {CAT_LABEL[k]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-[#173e2d] px-4 py-3 text-white shadow-[0_8px_20px_rgba(23,62,45,.14)]">
                <span className="mt-0.5 text-[#7ed6ad]">✦</span>
                <p className="text-[12px] font-semibold leading-5">{posting.verdict}</p>
              </div>
            </div>
          )}

          <div className="flex gap-1 overflow-x-auto border-b border-[#edf0ee] bg-white px-4 pt-3">
            {(
              [
                ["intro", "지원 초안"],
                ["resume", "이력서 강조점"],
                ["interview", `면접 예상 질문 (${data.interview.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`whitespace-nowrap rounded-t-xl border-b-2 px-3 py-2.5 text-[12px] ${
                  tab === key
                    ? "border-[#167b57] font-extrabold text-[#167b57]"
                    : "border-transparent font-semibold text-[#8b958f] hover:text-[#4d5a52]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
          {tab === "intro" && <SentenceList sentences={intro?.sentences ?? []} />}
          {tab === "resume" && (
            <SentenceList sentences={resume?.sentences ?? []} bullet />
          )}
          {tab === "interview" && (
            <ul className="space-y-3">
              {data.interview.map((q) => (
                <li key={q.id} className="rounded-2xl border border-[#e3e9e5] bg-[#fbfcfb] p-4">
                  <div className="mb-2 text-[13px] font-extrabold leading-6 text-[#344139]">
                    {q.qtype === "weakness" && (
                      <span className="mr-2 rounded-full bg-[#fff0d5] px-2.5 py-1 text-[9px] font-black tracking-[0.04em] text-[#966427]">
                        약점 찌르기
                      </span>
                    )}
                    Q. {q.question}
                  </div>
                  <ul className="space-y-1">
                    {q.answerPoints.map((p) => (
                      <li key={p.id} className="pl-3 text-[12px] leading-6 text-[#5f6c64]">
                        {p.type === "placeholder" ? (
                          <span className="text-amber-700">⚠ {p.text}</span>
                        ) : (
                          <>
                            • {p.text}{" "}
                            {p.sourceTitle && <Chip>출처: {p.sourceTitle}</Chip>}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          </div>
        </section>

        {/* 오른쪽: 되묻기 */}
        <section className="surface overflow-hidden lg:col-span-2 2xl:col-span-1">
          <div className="border-b border-[#edf0ee] bg-[linear-gradient(135deg,#fff9ed,#fff)] px-5 py-4"><p className="text-[10px] font-black tracking-[0.1em] text-[#b07730]">GROW YOUR BANK</p><h2 className="mt-1 text-[15px] font-extrabold">AI가 되묻는 질문 <span className="text-[#b07730]">{openAskbacks.length}</span></h2></div>
          <div className="p-4">
          {openAskbacks.length === 0 && (
            <p className="rounded-2xl bg-[#f5f8f6] p-4 text-[11px] leading-5 text-[#7e8a83]">
              열린 질문이 없어요. 모든 요구사항에 근거가 있거나, 이미 답하셨어요.
            </p>
          )}
          <ul className="space-y-3">
            {openAskbacks.map((a) => (
              <AskbackItem key={a.id} askback={a} onAnswered={load} />
            ))}
          </ul>
          {answeredAskbacks.length > 0 && (
            <div className="mt-4 border-t border-[#edf0ee] pt-4">
              <h3 className="mb-2 text-[10px] font-black tracking-[0.08em] text-[#8b958f]">
                답변 완료 ({answeredAskbacks.length})
              </h3>
              <ul className="space-y-2">
                {answeredAskbacks.map((a) => (
                  <li key={a.id} className="rounded-xl bg-[#f5f8f6] p-3 text-[11px]">
                    <div className="font-semibold leading-5 text-[#59665e]">{a.question}</div>
                    <div className="mt-1.5 leading-5 text-[#167b57]">
                      → 경험카드 #{a.resultCardId}로 저장됨. &quot;다시 분석&quot;하면
                      초안에 반영돼요.
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={retryAnalyze}
                className="mt-3 w-full rounded-xl bg-[#172d22] py-2.5 text-[11px] font-bold text-white hover:bg-[#167b57]"
              >
                새 카드 반영해서 다시 분석
              </button>
            </div>
          )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SentenceList({
  sentences,
  bullet,
}: {
  sentences: Detail["drafts"][number]["sentences"];
  bullet?: boolean;
}) {
  if (sentences.length === 0)
    return <p className="rounded-2xl bg-[#f5f8f6] p-5 text-center text-[11px] text-[#88938c]">생성된 내용이 없어요.</p>;
  return (
    <ul className="space-y-3">
      {sentences.map((s) => (
        <li
          key={s.id}
          className={`rounded-2xl border p-4 text-[13px] leading-7 ${
            s.type === "placeholder"
              ? "border-dashed border-[#e8c8a0] bg-[#fff8eb] text-[#815c2c]"
              : s.warning === "over_claim"
                ? "border-[#e7c07e] bg-[#fff9ed] text-[#654a25]"
                : "border-[#e2e8e4] bg-[#fbfcfb] text-[#435048]"
          }`}
        >
          {s.type === "placeholder" ? (
            <>⚠ {s.text}</>
          ) : (
            <>
              {bullet && "• "}
              {s.text}{" "}
              {s.primarySourceCardId && (
                <Chip>
                  출처: #{s.primarySourceCardId} {s.primarySourceTitle}
                </Chip>
              )}
              {s.additionalSources.map((x) => (
                <Chip key={x.cardId}>+#{x.cardId}</Chip>
              ))}
              {s.warning === "weak_evidence" && (
                <span className="ml-1 rounded-full bg-[#fff0d5] px-2 py-1 text-[9px] font-bold text-[#966427]">근거 약함</span>
              )}
              {s.warning === "over_claim" && (
                <span className="ml-1 text-[10px] font-semibold text-[#9a6425]">
                  ⚠ 카드 범위를 넘는 주장일 수 있어요 — 확인 필요
                </span>
              )}
              {s.sourceChanged && (
                <span className="ml-1 text-[10px] font-semibold text-[#42725c]">
                  출처 카드가 수정됨
                </span>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function AskbackItem({
  askback,
  onAnswered,
}: {
  askback: Detail["askbacks"][number];
  onAnswered: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/askbacks/${askback.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      onAnswered();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4">
      <div className="mb-1.5 text-[12px] font-extrabold leading-5 text-[#4b4031]">Q. {askback.question}</div>
      <p className="mb-3 text-[10px] leading-5 text-[#928472]">{askback.why}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="여기 답하면 새 경험카드로 저장돼요. 관련 경험이 없으면 '없음'이라고 적어도 돼요."
        className="field mb-2 h-24 resize-y border-dashed bg-white text-[11px]"
      />
      {error && <p className="mb-2 rounded-lg bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !answer.trim()}
        className="w-full rounded-xl border border-[#d6dfda] bg-white px-3 py-2.5 text-[11px] font-bold text-[#405047] hover:border-[#91c5ac] hover:bg-[#f1faf5] hover:text-[#167b57] disabled:opacity-40"
      >
        {busy ? "카드로 저장 중…" : "답변 → 경험카드로 저장"}
      </button>
    </li>
  );
}
