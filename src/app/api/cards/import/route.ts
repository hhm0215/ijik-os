import { z } from "zod";
import { generateStructured, llmProviderInfo } from "@/lib/llm";
import { extractDocument } from "@/lib/document-import";
import { isSourceQuoteVerified } from "@/lib/card-import-policy";

export const maxDuration = 600;

const MAX_FILES = 5;
const MAX_SOURCE_CHARS = 32_000;

const importedCardSchema = z.object({
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

export async function POST(request: Request) {
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
      system: `이력서·자기소개서·포트폴리오에서 경험 카드를 정리하는 편집자다. 모든 출력은 한국어.

절대 원칙:
- 문서에 실제로 적힌 경험·역할·행동·성과만 사용한다. 없는 수치, 기술, 책임을 만들지 않는다.
- 서로 다른 프로젝트나 경험을 한 카드로 합치지 않는다.
- 같은 경험이 여러 문서에 중복되면 하나로 합치되, 문서에 있는 정보만 보완한다.
- 카드 title/situation/role/action은 저장에 필요한 핵심 필드다. 문서에서 확정할 수 없는 필드는 짧고 정직하게 정리하고 needsReview에 해당 필드명을 넣는다.
- resultMetrics는 문서에 수치나 명확한 결과가 있을 때만 쓴다.
- evidenceSentence는 문서의 표현을 살린, 지원서에서 사용할 수 있는 한두 문장이다. 과장하지 않는다.
- claimable은 이 경험으로 증명 가능한 역량만, notClaimable은 문서만으로 주장할 수 없는 인접 영역이 분명할 때만 쓴다.
- sourceQuote에는 이 카드를 만든 근거가 된 원문 일부를 짧게 그대로 인용한다.
- tags는 쉼표로 구분한다.
- 최대 12개, 의미 있는 경험만 추출한다.`,
      user: source,
    });

    const cards = result.cards.map((card) => {
      return {
        ...card,
        sourceQuoteVerified: isSourceQuoteVerified(source, card.sourceQuote),
      };
    });

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
}
