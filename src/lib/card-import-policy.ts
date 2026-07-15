import { z } from "zod";

const cardInputSchema = z.object({
  title: z.string().trim().min(1),
  situation: z.string().trim().min(1),
  role: z.string().trim().min(1),
  action: z.string().trim().min(1),
  resultMetrics: z.string().trim().default(""),
  learned: z.string().trim().default(""),
  evidenceSentence: z.string().trim().default(""),
  claimable: z.string().trim().default(""),
  notClaimable: z.string().trim().default(""),
  tags: z.string().trim().default(""),
});

export const cardBatchSchema = z.object({
  cards: z.array(cardInputSchema).min(1).max(12),
});

function normalizeForQuoteCheck(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[“”„‟‘’‚‛"'`]/g, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("ko-KR");
}

export function isSourceQuoteVerified(source: string, quote: string): boolean {
  const normalizedQuote = normalizeForQuoteCheck(quote);
  return (
    normalizedQuote.length >= 10 &&
    normalizeForQuoteCheck(source).includes(normalizedQuote)
  );
}
