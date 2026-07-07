"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasteForm() {
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
    <aside className="h-fit rounded-md border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 font-semibold">공고 붙여넣기</h2>
      <p className="mb-3 text-[12px] text-neutral-500">
        원티드/잡코리아 등에서 공고 본문을 복사해 붙여넣으면, 내 경험 카드와
        매칭해서 초안·되묻기·면접 질문을 만들어요.
      </p>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="채용 공고 본문 전체를 붙여넣으세요"
        className="mb-2 h-56 w-full resize-y rounded border border-neutral-300 p-2 text-[13px]"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="공고 URL (선택)"
        className="mb-3 w-full rounded border border-neutral-300 p-2 text-[13px]"
      />
      {error && <p className="mb-2 text-[12px] text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || rawText.trim().length < 50}
        className="w-full rounded bg-neutral-900 py-2 font-semibold text-white disabled:opacity-40"
      >
        {busy ? "등록 중…" : "등록하고 분석 시작"}
      </button>
    </aside>
  );
}
