"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasteForm({ hasCards }: { hasCards: boolean }) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/postings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, url }),
      });
      const posting = await res.json();
      if (!res.ok) throw new Error(posting.error ?? "등록 실패");
      // 분석은 백그라운드로 시작 — 상세 페이지에서 진행 상황 폴링
      fetch(`/api/postings/${posting.id}/analyze`, { method: "POST" }).catch(
        () => {}
      );
      router.push(`/postings/${posting.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <aside className="surface sticky top-[92px] h-fit overflow-hidden">
      <div className="border-b border-[#edf0ee] bg-[linear-gradient(135deg,#f2faf6,#fff9ef)] px-5 py-4">
        <p className="text-[10px] font-black tracking-[0.11em] text-[#167b57]">NEW ANALYSIS</p>
        <h2 className="mt-1 text-[17px] font-extrabold tracking-[-0.035em]">공고 붙여넣기</h2>
      </div>
      <div className="p-5">
      <p className="mb-4 text-[12px] leading-6 text-[#708078]">
        원티드/잡코리아 등에서 공고 본문을 복사해 붙여넣으면, 내 경험 카드와
        매칭해서 초안·되묻기·면접 질문을 만들어요.
      </p>
      {!hasCards && (
        <p className="mb-4 rounded-xl border border-[#f1d49d] bg-[#fff8e8] p-3 text-[12px] leading-5 text-[#7d5b22]">
          <strong className="block">경험 카드가 먼저 필요해요</strong>
          홈 위의 버튼을 눌러 내 경험을 하나 등록하세요.
        </p>
      )}
      <label className="mb-2 block text-[12px] font-bold text-[#435048]">채용 공고 본문</label>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="채용 공고 본문 전체를 붙여넣으세요"
        className="field mb-3 h-60 resize-y"
      />
      <label className="mb-2 block text-[12px] font-bold text-[#435048]">공고 URL <span className="font-normal text-[#98a29c]">선택</span></label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="공고 URL (선택)"
        className="field mb-4"
      />
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-[12px] text-red-700">{error}</p>}
      <button
        onClick={submit}
        disabled={!hasCards || busy || rawText.trim().length < 50}
        className="w-full rounded-xl bg-[#172d22] py-3 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(23,45,34,.15)] hover:-translate-y-0.5 hover:bg-[#167b57] disabled:cursor-not-allowed disabled:bg-[#dfe5e1] disabled:text-[#96a099] disabled:shadow-none"
      >
        {busy ? "분석을 준비하고 있어요…" : "등록하고 분석 시작 →"}
      </button>
      <p className="mt-3 text-center text-[10px] leading-5 text-[#9aa49e]">입력한 공고와 경험은 이 기기 안에 저장됩니다.</p>
      </div>
    </aside>
  );
}
