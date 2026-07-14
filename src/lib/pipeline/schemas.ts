import { z } from "zod";

export const CATEGORIES = ["tech", "domain", "collab", "impact"] as const;
export const CATEGORY_LABELS: Record<string, string> = {
  tech: "기술",
  domain: "도메인",
  collab: "협업",
  impact: "성과",
};

export const extractionSchema = z.object({
  title: z.string(),
  company: z.string(),
  requirements: z.array(
    z.object({
      category: z.enum(CATEGORIES),
      text: z.string(),
    })
  ),
});
export type Extraction = z.infer<typeof extractionSchema>;

const strength = z.enum(["strong", "medium", "weak"]);

export const analysisSchema = z.object({
  matches: z.array(
    z.object({
      requirementIndex: z.number().int(),
      cardId: z.number().int(),
      strength,
      rationale: z.string(),
    })
  ),
  fit: z.object({
    tech: z.number().int(),
    domain: z.number().int(),
    collab: z.number().int(),
    impact: z.number().int(),
    overall: z.number().int(),
  }),
  verdict: z.string(),
  introDraft: z.array(
    z.object({
      text: z.string(),
      primaryCardId: z.number().int(),
      additionalCardIds: z.array(z.number().int()),
      weakEvidence: z.boolean(),
    })
  ),
  resumePoints: z.array(
    z.object({
      text: z.string(),
      primaryCardId: z.number().int(),
    })
  ),
  askbacks: z.array(
    z.object({
      requirementIndex: z.number().int().nullable(),
      question: z.string(),
      why: z.string(),
    })
  ),
});
export type Analysis = z.infer<typeof analysisSchema>;

const interviewQuestionSchema = z.object({
  question: z.string(),
  qtype: z.enum(["posting", "weakness"]),
  answerPoints: z.array(
    z.object({
      text: z.string(),
      cardId: z.number().int().nullable(),
    })
  ),
});

// 로컬 8B 모델은 한 호출에서 posting/weakness 질문을 함께 요구하면 weakness를
// 간헐적으로 생략한다. 질문 유형별로 호출과 JSON 스키마를 분리해 개수를 강제한다.
export const postingInterviewSchema = z.object({
  questions: z
    .array(interviewQuestionSchema.extend({ qtype: z.literal("posting") }))
    .min(6)
    .max(10),
});

export const weaknessInterviewSchema = z.object({
  questions: z
    .array(interviewQuestionSchema.extend({ qtype: z.literal("weakness") }))
    .length(3),
});

export type Interview = {
  questions: z.infer<typeof interviewQuestionSchema>[];
};

export const verificationSchema = z.object({
  results: z.array(
    z.object({
      sentenceIndex: z.number().int(),
      withinClaimable: z.boolean(),
      reason: z.string(),
    })
  ),
});
export type Verification = z.infer<typeof verificationSchema>;
