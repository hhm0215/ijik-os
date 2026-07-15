"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mergeSelectedImportCandidates } from "@/lib/card-import-merge";
import type { CardValues } from "../card-form";

type Candidate = CardValues & {
  clientId: string;
  sourceQuote: string;
  sourceQuoteVerified: boolean;
  needsReview: (keyof CardValues)[];
  selected: boolean;
};

type ImportResponse = {
  cards: Omit<Candidate, "clientId" | "selected">[];
  sources: string[];
  truncated: boolean;
  provider: string;
  error?: string;
};

type CoreField = "title" | "situation" | "role" | "action";

const CORE_FIELDS: { key: CoreField; label: string }[] = [
  { key: "title", label: "제목" },
  { key: "situation", label: "상황" },
  { key: "role", label: "내 역할" },
  { key: "action", label: "행동" },
];

const EXTRA_FIELDS: { key: keyof CardValues; label: string }[] = [
  { key: "resultMetrics", label: "결과 수치" },
  { key: "learned", label: "배운 점" },
  { key: "evidenceSentence", label: "증거 문장" },
  { key: "claimable", label: "주장해도 되는 것" },
  { key: "notClaimable", label: "주장하면 안 되는 것" },
  { key: "tags", label: "태그" },
];

export default function DocumentImporter() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [meta, setMeta] = useState<{ provider: string; truncated: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedCount = candidates.filter((card) => card.selected).length;

  async function analyze() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.append("text", text);
      const response = await fetch("/api/cards/import", { method: "POST", body });
      const result = (await response.json()) as ImportResponse;
      if (!response.ok) throw new Error(result.error ?? "문서를 분석하지 못했어요.");
      setCandidates(result.cards.map((card) => ({
        ...card,
        clientId: crypto.randomUUID(),
        selected: false,
      })));
      setMeta({ provider: result.provider, truncated: result.truncated });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function updateCandidate(index: number, key: keyof CardValues, value: string) {
    setCandidates((current) => current.map((card, cardIndex) =>
      cardIndex === index ? { ...card, [key]: value } : card
    ));
  }

  function mergeSelected() {
    if (selectedCount < 2) return;
    const firstSelectedIndex = candidates.findIndex((candidate) => candidate.selected);
    if (!confirm(`같은 프로젝트·역할·기간인 후보만 합쳐 주세요. 선택한 ${selectedCount}개를 화면에서 가장 위에 있는 경험 후보 ${firstSelectedIndex + 1}을 기준으로 합칠까요? 합친 뒤 내용을 수정할 수 있습니다.`)) return;

    const result = mergeSelectedImportCandidates(candidates);
    setCandidates(result.candidates);
    setError(null);
    setNotice(`${result.mergedCount}개 후보를 하나로 합쳤습니다. 제목과 중복 문구를 확인해 주세요.`);
  }

  async function saveSelected() {
    const selected = candidates.filter((card) => card.selected);
    if (selected.length === 0) {
      setError("저장할 경험 카드를 하나 이상 선택해 주세요.");
      return;
    }
    const incomplete = selected.find((card) => !card.title.trim() || !card.situation.trim() || !card.role.trim() || !card.action.trim());
    if (incomplete) {
      setError(`「${incomplete.title || "제목 없음"}」 카드의 제목·상황·내 역할·행동을 확인해 주세요.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/cards/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: selected }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "경험 카드 일괄 저장 실패");
      }
      router.push("/cards");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="surface overflow-hidden p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#172d22] text-lg text-white">⇧</span>
          <div>
            <p className="text-[10px] font-black tracking-[0.12em] text-[#167b57]">DOCUMENT TO EXPERIENCE</p>
            <h1 className="mt-1 text-[25px] font-black tracking-[-0.045em]">문서에서 경험 카드 빠르게 만들기</h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#748078]">이력서·자소서·포트폴리오에서 경험 후보를 찾아 카드 형태로 정리합니다. 바로 저장하지 않으니 원문과 비교해 수정한 뒤 선택하세요.</p>
          </div>
        </div>
      </header>

      {candidates.length === 0 ? (
        <section className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-[12px] font-bold text-[#3d4a42]">문서 업로드</label>
            <label
              className="grid min-h-48 cursor-pointer place-items-center rounded-2xl border border-dashed border-[#b9c9c0] bg-[#f9fbfa] p-6 text-center hover:border-[#66ad8c] hover:bg-[#f1faf5]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setFiles(Array.from(event.dataTransfer.files).slice(0, 5));
              }}
            >
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                className="sr-only"
                onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))}
              />
              <span>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e9f6ef] text-xl text-[#167b57]">＋</span>
                <strong className="mt-3 block text-[13px]">파일을 선택하거나 여기에 놓으세요</strong>
                <span className="mt-1 block text-[10px] text-[#8a958f]">PDF · DOCX · TXT · MD / 각 10MB / 최대 5개</span>
              </span>
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">{files.map((file) => <li key={`${file.name}-${file.size}`} className="flex items-center justify-between rounded-xl bg-[#f1f6f3] px-3 py-2 text-[11px]"><span className="truncate font-semibold">{file.name}</span><span className="text-[#89938d]">{Math.ceil(file.size / 1024)}KB</span></li>)}</ul>
            )}
          </div>
          <div>
            <label className="mb-2 block text-[12px] font-bold text-[#3d4a42]">또는 내용 직접 붙여넣기</label>
            <textarea value={text} onChange={(event) => setText(event.target.value)} className="field min-h-48 resize-y" placeholder="이력서나 포트폴리오의 텍스트를 붙여넣어도 돼요." />
            <div className="mt-4 rounded-xl bg-[#fff8e9] p-3 text-[10px] leading-5 text-[#80602d]">문서는 카드 후보를 만든 뒤 보관하지 않습니다. API 키가 설정돼 있으면 문서 내용이 해당 AI 제공자로 전송될 수 있어요.</div>
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-[11px] text-red-700">{error}</p>}
            <button onClick={analyze} disabled={busy || (files.length === 0 && text.trim().length < 30)} className="mt-4 w-full rounded-xl bg-[#167b57] py-3 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(22,123,87,.18)] hover:bg-[#0e6949] disabled:cursor-not-allowed disabled:bg-[#dfe5e1] disabled:text-[#96a099] disabled:shadow-none">
              {busy ? "문서에서 경험을 찾고 있어요…" : "경험 카드 후보 만들기 →"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="surface flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
            <div><strong className="text-[13px]">{candidates.length}개의 경험 후보</strong><p className="mt-1 text-[10px] text-[#839087]">{meta?.provider}로 정리됨{meta?.truncated ? " · 긴 문서의 뒷부분은 제외됨" : ""}</p><p className="mt-1 text-[10px] text-[#647169]">같은 프로젝트·역할·기간인데 나뉜 후보는 체크한 뒤 아래에서 합칠 수 있어요.</p></div>
            <button onClick={() => { setCandidates([]); setMeta(null); setError(null); setNotice(null); }} className="rounded-xl border border-[#dce3df] px-3 py-2 text-[11px] font-semibold text-[#67736c] hover:bg-[#f4f6f5]">다른 문서 선택</button>
          </section>

          <div className="space-y-4">
            {candidates.map((card, index) => (
              <article key={card.clientId} className={`surface overflow-hidden ${card.selected ? "border-[#a7d6c0]" : "opacity-60"}`}>
                <div className="flex items-center gap-3 border-b border-[#edf0ee] px-5 py-4">
                  <input type="checkbox" aria-label={`경험 후보 ${index + 1} 선택`} checked={card.selected} onChange={(event) => setCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected: event.target.checked } : item))} className="size-4 accent-[#167b57]" />
                  <strong className="flex-1 text-[13px]">경험 후보 {index + 1}</strong>
                  {card.needsReview.length > 0 && <span className="rounded-full bg-[#fff0d7] px-2.5 py-1 text-[9px] font-bold text-[#996729]">검토 필요 {card.needsReview.length}</span>}
                </div>
                <div className="grid gap-5 p-5 md:grid-cols-2">
                  {CORE_FIELDS.map((field) => (
                    <label key={field.key} className={field.key === "situation" || field.key === "action" ? "md:col-span-2" : ""}>
                      <span className="mb-1.5 block text-[11px] font-bold text-[#435048]">{field.label}{card.needsReview.includes(field.key) && <em className="ml-1 not-italic text-[#b16e24]">확인</em>}</span>
                      {field.key === "situation" || field.key === "action" ? <textarea value={card[field.key]} onChange={(event) => updateCandidate(index, field.key, event.target.value)} className="field min-h-24 resize-y" /> : <input value={card[field.key]} onChange={(event) => updateCandidate(index, field.key, event.target.value)} className="field" />}
                    </label>
                  ))}
                  <details className="md:col-span-2 rounded-2xl border border-[#e5eae7] bg-[#fafbfa] p-4">
                    <summary className="cursor-pointer text-[11px] font-bold text-[#536159]">성과·배운 점·주장 범위 등 추가 항목</summary>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">{EXTRA_FIELDS.map((field) => <label key={field.key} className={field.key === "evidenceSentence" || field.key === "claimable" ? "md:col-span-2" : ""}><span className="mb-1.5 block text-[10px] font-bold text-[#647169]">{field.label}{card.needsReview.includes(field.key) && <em className="ml-1 not-italic text-[#b16e24]">확인</em>}</span><textarea value={card[field.key]} onChange={(event) => updateCandidate(index, field.key, event.target.value)} className="field min-h-20 resize-y text-[12px]" /></label>)}</div>
                  </details>
                  <div className={`whitespace-pre-wrap md:col-span-2 rounded-xl p-3 text-[10px] leading-5 ${card.sourceQuoteVerified ? "bg-[#f2f6f4] text-[#718078]" : "bg-[#fff7e8] text-[#87602b]"}`}>
                    <strong className={card.sourceQuoteVerified ? "text-[#536159]" : "text-[#9a6729]"}>
                      원문 근거 {card.sourceQuoteVerified ? "✓" : "· 직접 확인 필요"}
                    </strong><br />
                    {card.sourceQuote || "원문에서 일치하는 인용을 확인하지 못했습니다. 카드 내용을 특히 주의해서 검토하세요."}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {notice && <p className="rounded-xl bg-[#edf8f2] p-3 text-[11px] text-[#176b4d]">{notice}</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-[11px] text-red-700">{error}</p>}
          <footer className="surface sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
            <p className="text-[11px] text-[#78847d]">선택한 {selectedCount}개 카드만 저장합니다.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={mergeSelected} disabled={selectedCount < 2 || saving} className="rounded-xl border border-[#a9cdbb] bg-white px-4 py-3 text-[12px] font-bold text-[#167b57] hover:bg-[#edf8f2] disabled:cursor-not-allowed disabled:border-[#dfe5e1] disabled:text-[#a2aba6]">
                선택한 {selectedCount}개 합치기
              </button>
              <button onClick={saveSelected} disabled={saving} className="rounded-xl bg-[#167b57] px-6 py-3 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(22,123,87,.18)] hover:bg-[#0e6949] disabled:opacity-50">{saving ? "카드를 저장하고 있어요…" : "선택한 카드 저장 →"}</button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
