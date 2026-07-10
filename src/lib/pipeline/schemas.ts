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

// 면접 질문은 별도 호출로 분리 — 분석 호출 하나에 몰면 로컬 8B 모델이 질문 수를 크게 줄인다
export const interviewSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      qtype: z.enum(["posting", "weakness"]),
      answerPoints: z.array(
        z.object({
          text: z.string(),
          cardId: z.number().int().nullable(),
        })
      ),
    })
  ),
});
export type Interview = z.infer<typeof interviewSchema>;

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
