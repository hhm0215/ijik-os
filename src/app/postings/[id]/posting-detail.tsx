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
    <span className="inline-block rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
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
    load();
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

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-neutral-400">불러오는 중…</p>;

  const { posting } = data;
  const fit = posting.fitJson ? JSON.parse(posting.fitJson) : null;

  if (posting.analysisStatus !== "done") {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-neutral-200 bg-white p-8 text-center">
        {posting.analysisStatus === "error" ? (
          <>
            <p className="mb-2 font-semibold text-red-600">분석 실패</p>
            <p className="mb-4 text-neutral-500">{posting.analysisError}</p>
            <button
              onClick={retryAnalyze}
              className="rounded bg-neutral-900 px-5 py-2 font-semibold text-white"
            >
              다시 분석
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 animate-pulse font-semibold">
              공고를 분석하는 중이에요…
            </p>
            <p className="text-neutral-500">
              요구사항 분해 → 경험 카드 매칭 → 초안 생성 → 정합성 검증. 보통
              1~3분 걸려요. 이 페이지는 자동으로 갱신돼요.
            </p>
            {posting.analysisStatus === "pending" && (
              <button
                onClick={retryAnalyze}
                className="mt-4 rounded border border-neutral-300 px-4 py-2 text-neutral-600"
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
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[16px] font-bold">
          {posting.title} <span className="font-normal text-neutral-500">· {posting.company}</span>
        </h1>
        {posting.url && (
          <a
            href={posting.url}
            target="_blank"
            className="text-[12px] text-blue-600 underline"
          >
            공고 링크
          </a>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setStatus("applied")}
            disabled={posting.pipelineStatus === "applied"}
            className="rounded bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {posting.pipelineStatus === "applied" ? "지원함 ✓" : "지원함으로 표시"}
          </button>
          <button
            onClick={() => setStatus("skipped")}
            disabled={posting.pipelineStatus === "skipped"}
            className="rounded border border-neutral-300 px-3 py-1.5 text-[12px] text-neutral-500 disabled:opacity-50"
          >
            {posting.pipelineStatus === "skipped" ? "스킵됨" : "스킵"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_320px]">
        {/* 왼쪽: 요구사항 분해 + 매칭 */}
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 border-b border-neutral-100 pb-2 font-semibold text-neutral-500">
            요구사항 분해 → 경험 매칭
          </h2>
          <ul className="space-y-2">
            {data.requirements.map((r) => (
              <li key={r.id} className="rounded border border-neutral-200 p-2.5">
                <div className="mb-1">
                  <Chip>{CAT_LABEL[r.category] ?? r.category}</Chip>{" "}
                  <span className="font-medium">{r.text}</span>
                </div>
                {r.matches.length > 0 ? (
                  r.matches.map((m) => (
                    <div
                      key={m.id}
                      className="mt-1 rounded bg-emerald-50 px-2 py-1 text-[12px] text-emerald-900"
                    >
                      ✓ ({STRENGTH_LABEL[m.strength]}) {m.cardTitle}{" "}
                      <Chip>카드 #{m.cardId}</Chip>
                    </div>
                  ))
                ) : (
                  <div className="mt-1 rounded border border-dashed border-red-300 bg-red-50 px-2 py-1 text-[12px] text-red-700">
                    ✗ 근거 없음 → 되묻기 질문 생성됨
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 가운데: 적합도 + 초안 */}
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          {fit && (
            <>
              <div className="mb-3 grid grid-cols-4 gap-2">
                {(["tech", "domain", "collab", "impact"] as const).map((k) => (
                  <div
                    key={k}
                    className="rounded border border-neutral-200 p-2 text-center"
                  >
                    <div
                      className={`text-lg font-bold ${fit[k] < 50 ? "text-red-600" : ""}`}
                    >
                      {fit[k]}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {CAT_LABEL[k]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-4 rounded border-2 border-neutral-700 bg-neutral-50 px-3 py-2 font-semibold">
                판정: {posting.verdict}
              </div>
            </>
          )}

          <div className="mb-3 flex gap-1 border-b border-neutral-200">
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
                className={`rounded-t px-3 py-1.5 text-[13px] ${
                  tab === key
                    ? "border border-b-0 border-neutral-300 bg-white font-semibold"
                    : "text-neutral-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "intro" && <SentenceList sentences={intro?.sentences ?? []} />}
          {tab === "resume" && (
            <SentenceList sentences={resume?.sentences ?? []} bullet />
          )}
          {tab === "interview" && (
            <ul className="space-y-3">
              {data.interview.map((q) => (
                <li key={q.id} className="rounded border border-neutral-200 p-3">
                  <div className="mb-1.5 font-semibold">
                    {q.qtype === "weakness" && (
                      <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                        약점 찌르기
                      </span>
                    )}
                    Q. {q.question}
                  </div>
                  <ul className="space-y-1">
                    {q.answerPoints.map((p) => (
                      <li key={p.id} className="text-[13px]">
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
        </section>

        {/* 오른쪽: 되묻기 */}
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 border-b border-neutral-100 pb-2 font-semibold text-neutral-500">
            AI가 되묻는 질문 ({openAskbacks.length})
          </h2>
          {openAskbacks.length === 0 && (
            <p className="text-[12px] text-neutral-400">
              열린 질문이 없어요. 모든 요구사항에 근거가 있거나, 이미 답하셨어요.
            </p>
          )}
          <ul className="space-y-3">
            {openAskbacks.map((a) => (
              <AskbackItem key={a.id} askback={a} onAnswered={load} />
            ))}
          </ul>
          {answeredAskbacks.length > 0 && (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <h3 className="mb-2 text-[12px] font-semibold text-neutral-400">
                답변 완료 ({answeredAskbacks.length})
              </h3>
              <ul className="space-y-2">
                {answeredAskbacks.map((a) => (
                  <li key={a.id} className="rounded bg-neutral-50 p-2 text-[12px]">
                    <div className="font-medium text-neutral-600">{a.question}</div>
                    <div className="mt-1 text-emerald-700">
                      → 경험카드 #{a.resultCardId}로 저장됨. &quot;다시 분석&quot;하면
                      초안에 반영돼요.
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={retryAnalyze}
                className="mt-3 w-full rounded border border-neutral-800 py-1.5 text-[12px] font-semibold"
              >
                새 카드 반영해서 다시 분석
              </button>
            </div>
          )}
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
    return <p className="text-[12px] text-neutral-400">생성된 내용이 없어요.</p>;
  return (
    <ul className="space-y-2">
      {sentences.map((s) => (
        <li
          key={s.id}
          className={`rounded border p-3 leading-relaxed ${
            s.type === "placeholder"
              ? "border-dashed border-red-300 bg-red-50 text-red-800"
              : s.warning === "over_claim"
                ? "border-amber-400 bg-amber-50"
                : "border-neutral-200"
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
                <span className="ml-1 text-[11px] text-amber-700">근거 약함</span>
              )}
              {s.warning === "over_claim" && (
                <span className="ml-1 text-[11px] font-semibold text-amber-800">
                  ⚠ 카드 범위를 넘는 주장일 수 있어요 — 확인 필요
                </span>
              )}
              {s.sourceChanged && (
                <span className="ml-1 text-[11px] text-blue-700">
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
    <li className="rounded border border-neutral-200 p-3">
      <div className="mb-1 font-semibold">Q. {askback.question}</div>
      <p className="mb-2 text-[12px] text-neutral-400">{askback.why}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="여기 답하면 새 경험카드로 저장돼요. 관련 경험이 없으면 '없음'이라고 적어도 돼요."
        className="mb-2 h-20 w-full resize-y rounded border border-dashed border-neutral-300 p-2 text-[12px]"
      />
      {error && <p className="mb-1 text-[12px] text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !answer.trim()}
        className="rounded border border-neutral-800 px-3 py-1 text-[12px] font-semibold disabled:opacity-40"
      >
        {busy ? "카드로 저장 중…" : "답변 → 경험카드로 저장"}
      </button>
    </li>
  );
}
