"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CardValues = {
  title: string;
  situation: string;
  role: string;
  action: string;
  resultMetrics: string;
  learned: string;
  evidenceSentence: string;
  claimable: string;
  notClaimable: string;
  tags: string;
};

const EMPTY: CardValues = {
  title: "",
  situation: "",
  role: "",
  action: "",
  resultMetrics: "",
  learned: "",
  evidenceSentence: "",
  claimable: "",
  notClaimable: "",
  tags: "",
};

const FIELDS: {
  key: keyof CardValues;
  label: string;
  hint: string;
  required?: boolean;
  textarea?: boolean;
}[] = [
  { key: "title", label: "제목", hint: "예: 정산 배치 개선", required: true },
  {
    key: "situation",
    label: "상황",
    hint: "어떤 배경/문제 상황이었나요?",
    required: true,
    textarea: true,
  },
  {
    key: "role",
    label: "내 역할",
    hint: "팀이 아니라 '내가' 맡은 부분",
    required: true,
  },
  {
    key: "action",
    label: "행동",
    hint: "구체적으로 뭘 했나요?",
    required: true,
    textarea: true,
  },
  {
    key: "resultMetrics",
    label: "결과 수치",
    hint: "예: 처리 시간 4시간 → 40분",
  },
  { key: "learned", label: "배운 점", hint: "이 경험에서 얻은 관점/교훈", textarea: true },
  {
    key: "evidenceSentence",
    label: "증거 문장",
    hint: "자소서/면접에서 그대로 쓸 수 있는 내 말투의 한두 문장",
    textarea: true,
  },
  {
    key: "claimable",
    label: "주장해도 되는 것",
    hint: "이 경험으로 '할 수 있다'고 말해도 거짓이 아닌 범위 — AI는 이 범위 안에서만 문장을 만들어요",
    textarea: true,
  },
  {
    key: "notClaimable",
    label: "주장하면 안 되는 것",
    hint: "과장이 되는 선. 예: 정산은 다뤘지만 결제 시스템 자체는 아님",
  },
  { key: "tags", label: "태그", hint: "쉼표 구분. 예: batch, 성능개선, MySQL" },
];

export default function CardForm({
  cardId,
  initial,
}: {
  cardId?: number;
  initial?: CardValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CardValues>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(cardId ? `/api/cards/${cardId}` : "/api/cards", {
        method: cardId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      router.push("/cards");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function archive() {
    if (!cardId) return;
    if (!confirm("이 카드를 보관 처리할까요? (삭제가 아니라 숨김이에요)")) return;
    await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    router.push("/cards");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl rounded-md border border-neutral-200 bg-white p-6">
      <h1 className="mb-4 text-[16px] font-bold">
        {cardId ? `경험 카드 #${cardId} 수정` : "새 경험 카드"}
      </h1>
      {!cardId && (
        <div className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-950">
          <strong>무엇을 적나요?</strong> 프로젝트·업무·문제 해결처럼 실제로 한 일 하나를 적으세요.
          특히 <strong>내 역할</strong>, <strong>행동</strong>, <strong>결과 수치</strong>가 구체적일수록 공고 분석 결과가 좋아집니다.
          AI는 아래의 “주장해도 되는 것” 범위를 넘는 문장을 만들지 않아요.
        </div>
      )}
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block font-semibold">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>
            <p className="mb-1 text-[12px] text-neutral-400">{f.hint}</p>
            {f.textarea ? (
              <textarea
                value={values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
                className="h-20 w-full resize-y rounded border border-neutral-300 p-2"
              />
            ) : (
              <input
                value={values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
                className="w-full rounded border border-neutral-300 p-2"
              />
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-neutral-900 px-5 py-2 font-semibold text-white disabled:opacity-40"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
        {cardId && (
          <button
            onClick={archive}
            className="rounded border border-neutral-300 px-5 py-2 text-neutral-500"
          >
            보관 처리
          </button>
        )}
      </div>
    </div>
  );
}
