import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, experienceCards } from "@/db";
import CardForm from "../card-form";

export const dynamic = "force-dynamic";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = db
    .select()
    .from(experienceCards)
    .where(eq(experienceCards.id, Number(id)))
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
