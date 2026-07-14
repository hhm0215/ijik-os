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

const GROUPS: { title: string; description: string; keys: (keyof CardValues)[] }[] = [
  {
    title: "경험의 맥락",
    description: "무슨 일이 있었고, 그 안에서 내가 맡은 부분을 적어요.",
    keys: ["title", "situation", "role"],
  },
  {
    title: "행동과 결과",
    description: "내가 실제로 한 행동과 확인 가능한 결과를 남겨요.",
    keys: ["action", "resultMetrics", "learned", "evidenceSentence"],
  },
  {
    title: "AI 사용 경계",
    description: "AI가 이 경험을 어디까지 활용해도 되는지 선을 정해요.",
    keys: ["claimable", "notClaimable", "tags"],
  },
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
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="surface overflow-hidden p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#167b57] text-lg font-black text-white shadow-[0_8px_20px_rgba(22,123,87,.2)]">✦</span>
          <div>
            <p className="text-[10px] font-black tracking-[0.12em] text-[#167b57]">EXPERIENCE CARD</p>
            <h1 className="mt-1 text-[24px] font-black tracking-[-0.045em]">
              {cardId ? `경험 카드 #${cardId} 수정` : "새 경험을 기록해볼까요?"}
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#748078]">프로젝트·업무·문제 해결처럼 실제로 한 일 하나를 적으세요. 구체적으로 쓸수록 공고 분석 결과의 근거가 단단해집니다.</p>
          </div>
        </div>
      </header>

      {GROUPS.map((group, groupIndex) => (
        <section key={group.title} className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[190px_1fr]">
          <div>
            <span className="text-[10px] font-black tracking-[0.12em] text-[#9aa49e]">0{groupIndex + 1}</span>
            <h2 className="mt-2 text-[16px] font-extrabold tracking-[-0.03em]">{group.title}</h2>
            <p className="mt-2 text-[11px] leading-5 text-[#87928b]">{group.description}</p>
          </div>
          <div className="space-y-5">
            {FIELDS.filter((field) => group.keys.includes(field.key)).map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-[12px] font-bold text-[#3d4a42]">
                  {f.label}
                  {f.required && <span className="ml-1 text-[#d45c50]">필수</span>}
                </label>
                <p className="mb-2 text-[11px] leading-5 text-[#8c9690]">{f.hint}</p>
                {f.textarea ? (
                  <textarea
                    value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="field min-h-28 resize-y"
                  />
                ) : (
                  <input
                    value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="field"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{error}</p>}
      <footer className="surface flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
        <p className="text-[11px] text-[#8b958f]">저장한 내용은 언제든 다시 수정할 수 있어요.</p>
        <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-xl bg-[#167b57] px-6 py-2.5 text-[13px] font-bold text-white shadow-[0_7px_18px_rgba(22,123,87,.2)] hover:-translate-y-0.5 hover:bg-[#0e6949] disabled:opacity-40"
        >
          {busy ? "저장하고 있어요…" : "경험 카드 저장"}
        </button>
        {cardId && (
          <button
            onClick={archive}
            className="rounded-xl border border-[#dce3df] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#6f7b74] hover:border-[#c9a6a1] hover:bg-red-50 hover:text-red-700"
          >
            보관 처리
          </button>
        )}
        </div>
      </footer>
      </div>
  );
}
