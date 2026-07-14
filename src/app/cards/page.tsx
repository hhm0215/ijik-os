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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-neutral-500">경험 뱅크 ({cards.length}장)</h1>
          <p className="mt-1 text-[12px] text-neutral-500">AI가 지원 자료를 만들 때 사용할 내 경험의 원본이에요. 한 카드에는 한 경험을 구체적으로 기록하세요.</p>
        </div>
        <Link
          href="/cards/new"
          className="rounded bg-neutral-900 px-4 py-2 font-semibold text-white"
        >
          + 새 경험 카드
        </Link>
      </div>
      {cards.length === 0 && (
        <p className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-neutral-400">
          경험 카드가 이 도구의 원본 데이터예요. AI는 여기 적힌 내용만
          재구성할 수 있어요. 가장 최근에 잘 해냈다고 생각하는 일 하나부터
          시작해보세요.
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              href={`/cards/${c.id}`}
              className="block h-full rounded-md border border-neutral-200 bg-white p-4 hover:border-neutral-400"
            >
              <div className="mb-1 font-semibold">
                #{c.id} {c.title}
              </div>
              <p className="mb-2 line-clamp-2 text-neutral-500">{c.situation}</p>
              {c.resultMetrics && (
                <p className="line-clamp-1 text-[12px] text-emerald-700">
                  성과: {c.resultMetrics}
                </p>
              )}
              {c.tags && (
                <p className="mt-2 text-[11px] text-neutral-400">{c.tags}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
