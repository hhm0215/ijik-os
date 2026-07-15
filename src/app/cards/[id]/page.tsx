import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, experienceCards } from "@/db";
import { requirePageSession } from "@/lib/auth-session";
import CardForm from "../card-form";

export const dynamic = "force-dynamic";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageSession();

  const { id } = await params;
  const card = db
    .select()
    .from(experienceCards)
    .where(
      and(
        eq(experienceCards.id, Number(id)),
        eq(experienceCards.userId, session.user.id)
      )
    )
    .get();
  if (!card) notFound();

  return (
    <CardForm
      cardId={card.id}
      initial={{
        title: card.title,
        situation: card.situation,
        role: card.role,
        action: card.action,
        resultMetrics: card.resultMetrics,
        learned: card.learned,
        evidenceSentence: card.evidenceSentence,
        claimable: card.claimable,
        notClaimable: card.notClaimable,
        tags: card.tags,
      }}
    />
  );
}
