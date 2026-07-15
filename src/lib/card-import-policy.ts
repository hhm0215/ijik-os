import { z } from "zod";

export const CARD_IMPORT_SYSTEM_PROMPT = `이력서·자기소개서·포트폴리오에서 경험 카드를 정리하는 편집자다. 모든 출력은 한국어.

절대 원칙:
- 문서에 실제로 적힌 경험·역할·행동·성과만 사용한다. 없는 수치, 기술, 책임을 만들지 않는다.

경험 분할·병합 정책:
- 경험 카드의 경계는 프로젝트·역할·기간이다. 같은 프로젝트·같은 역할·같은 기간의 내용은 반드시 하나의 경험 카드로 통합한다.
- 같은 경험 안에 업무·행동·문제 해결·성과·사용 기술·문서 항목이 여러 개 있어도 분리하지 않는다. 업무 항목이나 성과가 여러 개라는 사실은 분리 근거가 아니다.
- 별도 프로젝트가 명확하거나, 역할 변경이 명시됐거나, 기간 구분이 명확할 때만 카드를 분리한다.
- 분리 경계가 불명확하면 나누지 말고 하나의 카드로 통합하며, 확신하기 어려운 필드는 needsReview에 넣는다.
- 예: 같은 주문 프로젝트에서 API 구현·성능 개선·장애 대응을 하고 성과가 세 개라면 카드 한 장의 action과 resultMetrics에 모두 정리한다.
- experienceIdentity의 project/role/period에는 각각 프로젝트·역할·전체 활동 기간만 쓴다. 업무·성과·기술이나 프로젝트 안의 세부 단계 일정은 넣지 않는다.
- 같은 프로젝트·역할·기간에는 같은 experienceIdentity 값을 사용한다. 문서에 없는 식별 항목은 추정하지 말고 정확히 '미상'이라고 쓴다.
- project에는 회사·조직이 명시된 경우 함께 써서 다른 조직의 동명 프로젝트가 섞이지 않게 한다.

내용 작성 정책:
- 같은 경험이 여러 문서에 중복되면 하나로 합치되, 문서에 있는 정보만 보완한다.
- card title/situation/role/action은 저장에 필요한 핵심 필드다. 문서에서 확정할 수 없는 필드는 짧고 정직하게 정리하고 needsReview에 해당 필드명을 넣는다.
- resultMetrics는 문서에 수치나 명확한 결과가 있을 때만 쓴다.
- evidenceSentence는 문서의 표현을 살린, 지원서에서 사용할 수 있는 한두 문장이다. 과장하지 않는다.
- claimable은 이 경험으로 증명 가능한 역량만, notClaimable은 문서만으로 주장할 수 없는 인접 영역이 분명할 때만 쓴다.
- sourceQuote에는 이 카드를 만든 근거가 된 원문 일부를 짧게 그대로 인용한다.
- tags는 쉼표로 구분한다.
- 최대 12개, 의미 있는 경험만 추출한다.`;

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
