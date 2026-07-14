import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, experienceCards } from "@/db";

export const dynamic = "force-dynamic";

export default function CardsPage() {
  const cards = db
    .select()
    .from(experienceCards)
    .where(eq(experienceCards.archived, false))
    .orderBy(desc(experienceCards.updatedAt))
    .all();

  return (
    <div className="space-y-6">
      <section className="surface flex flex-col justify-between gap-5 overflow-hidden p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-[11px] font-black tracking-[0.1em] text-[#167b57]">EXPERIENCE BANK</p>
          <h1 className="mt-2 text-[28px] font-black tracking-[-0.05em]">내 경험의 원본 보관함</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#718078]">AI가 지원 자료를 만들 때 사용할 사실의 원본이에요. 프로젝트 하나, 문제 해결 하나처럼 카드마다 한 경험을 구체적으로 기록하세요.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/cards/import" className="rounded-xl border border-[#d7e3dc] bg-white px-5 py-3 text-[13px] font-bold text-[#4d6558] hover:border-[#9ccbb5] hover:text-[#167b57]">⇧ 문서에서 가져오기</Link>
          <Link
            href="/cards/new"
            className="rounded-xl bg-[#167b57] px-5 py-3 text-[13px] font-bold text-white shadow-[0_8px_22px_rgba(22,123,87,.2)] hover:-translate-y-0.5 hover:bg-[#0e6949]"
          >
            + 직접 작성
          </Link>
        </div>
      </section>
      {cards.length === 0 && (
        <section className="surface grid min-h-72 place-items-center border-dashed p-8 text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#edf8f2] text-2xl">✦</span>
            <h2 className="mt-5 text-[17px] font-extrabold">첫 경험을 기록해보세요</h2>
            <p className="mt-2 text-[12px] leading-6 text-[#7e8a83]">가장 최근에 잘 해냈다고 생각하는 일 하나부터 시작하면 돼요.<br />AI는 여기에 적힌 내용만 재구성합니다.</p>
          </div>
        </section>
      )}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cards/${c.id}`}
              className="surface group block h-full p-5 hover:-translate-y-1 hover:border-[#b9d8c8] hover:shadow-[0_18px_45px_rgba(22,70,48,.09)]"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-lg bg-[#edf7f2] px-2.5 py-1 text-[10px] font-black text-[#167b57]">CARD #{c.id}</span>
                <span className="text-[#adb6b0] group-hover:translate-x-1 group-hover:text-[#167b57]">→</span>
              </div>
              <h2 className="text-[16px] font-extrabold tracking-[-0.03em] text-[#27352d]">{c.title}</h2>
              <p className="mt-2 line-clamp-2 min-h-10 text-[12px] leading-5 text-[#758179]">{c.situation}</p>
              {c.resultMetrics && (
                <p className="mt-4 line-clamp-1 rounded-lg bg-[#f2faf6] px-3 py-2 text-[11px] font-semibold text-[#167b57]">
                  ↗ {c.resultMetrics}
                </p>
              )}
              {c.tags && (
                <div className="mt-4 flex flex-wrap gap-1.5">{c.tags.split(",").map((tag) => <span key={tag} className="rounded-full bg-[#f1f3f2] px-2 py-1 text-[10px] text-[#758179]">{tag.trim()}</span>)}</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
