import { z } from "zod";
import { userRoute } from "@/lib/auth-session";
import { generateStructured, llmProviderInfo } from "@/lib/llm";
import { extractDocument } from "@/lib/document-import";
import {
  CARD_IMPORT_SYSTEM_PROMPT,
  isSourceQuoteVerified,
} from "@/lib/card-import-policy";
import { finalizeImportCandidates } from "@/lib/card-import-merge";

export const maxDuration = 600;

const MAX_FILES = 5;
const MAX_SOURCE_CHARS = 32_000;

const importedCardSchema = z.object({
  experienceIdentity: z.object({
    project: z.string().trim().min(1),
    role: z.string().trim().min(1),
    period: z.string().trim().min(1),
  }),
  title: z.string(),
  situation: z.string(),
  role: z.string(),
  action: z.string(),
  resultMetrics: z.string(),
  learned: z.string(),
  evidenceSentence: z.string(),
  claimable: z.string(),
  notClaimable: z.string(),
  tags: z.string(),
  sourceQuote: z.string(),
  needsReview: z.array(
    z.enum([
      "title",
      "situation",
      "role",
      "action",
      "resultMetrics",
      "learned",
      "evidenceSentence",
      "claimable",
      "notClaimable",
      "tags",
    ])
  ),
});

const importSchema = z.object({
  cards: z.array(importedCardSchema).min(1).max(12),
});

export const POST = userRoute(async (request) => {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const pastedText = String(formData.get("text") ?? "").trim();

    if (files.length > MAX_FILES) {
      return Response.json({ error: `파일은 최대 ${MAX_FILES}개까지 올릴 수 있습니다.` }, { status: 400 });
    }
    if (files.length === 0 && pastedText.length < 30) {
      return Response.json({ error: "문서를 올리거나 30자 이상의 내용을 붙여넣어 주세요." }, { status: 400 });
    }

    const documents = await Promise.all(files.map(extractDocument));
    if (pastedText) documents.push({ name: "직접 붙여넣은 내용", text: pastedText });

    const fullSource = documents
      .map((document) => `## 문서: ${document.name}\n${document.text}`)
      .join("\n\n");
    const truncated = fullSource.length > MAX_SOURCE_CHARS;
    const source = fullSource.slice(0, MAX_SOURCE_CHARS);

    const result = await generateStructured({
      schema: importSchema,
      maxTokens: 12_000,
      system: CARD_IMPORT_SYSTEM_PROMPT,
      user: source,
    });

    const verifiedCards = result.cards.map((card) => {
      return {
        ...card,
        sourceQuoteVerified: isSourceQuoteVerified(source, card.sourceQuote),
      };
    });
    const cards = finalizeImportCandidates(verifiedCards);

    return Response.json({
      cards,
      sources: documents.map((document) => document.name),
      truncated,
      provider: llmProviderInfo(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
});
