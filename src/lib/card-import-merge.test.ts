import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consolidateImportCandidates,
  finalizeImportCandidates,
  mergeSelectedImportCandidates,
  type ExperienceIdentity,
  type MergeableImportCandidate,
} from "./card-import-merge";

type Candidate = MergeableImportCandidate & {
  experienceIdentity: ExperienceIdentity;
  selected: boolean;
};

function identity(overrides: Partial<ExperienceIdentity> = {}): ExperienceIdentity {
  return {
    project: "주문 플랫폼",
    role: "백엔드 개발자",
    period: "2024.01-2024.06",
    ...overrides,
  };
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    title: "주문 플랫폼 개선",
    situation: "주문량 증가에 대응해야 했다.",
    role: "백엔드 개발자",
    action: "주문 API를 개선했다.",
    resultMetrics: "",
    learned: "",
    evidenceSentence: "",
    claimable: "주문 API 개선 경험",
    notClaimable: "",
    tags: "Node.js, API",
    sourceQuote: "주문 API를 개선했다.",
    sourceQuoteVerified: true,
    needsReview: [],
    experienceIdentity: identity(),
    selected: false,
    ...overrides,
  };
}

describe("consolidateImportCandidates", () => {
  it("merges multiple duties and results from the same project, role, and period", () => {
    const result = consolidateImportCandidates([
      candidate({ action: "주문 API를 개선했다.", resultMetrics: "응답 시간을 30% 줄였다." }),
      candidate({ action: "장애 알림을 구축했다.", resultMetrics: "탐지 시간을 10분 줄였다." }),
    ]);

    assert.equal(result.length, 1);
    assert.match(result[0].action, /주문 API를 개선했다/);
    assert.match(result[0].action, /장애 알림을 구축했다/);
    assert.match(result[0].resultMetrics, /응답 시간을 30% 줄였다/);
    assert.match(result[0].resultMetrics, /탐지 시간을 10분 줄였다/);
  });

  it("deduplicates repeated prose and tags while preserving source order", () => {
    const result = consolidateImportCandidates([
      candidate(),
      candidate({ action: "주문 API를 개선했다.", tags: "API, SQLite, Node.js" }),
    ]);

    assert.equal(result[0].action, "주문 API를 개선했다.");
    assert.equal(result[0].tags, "Node.js, API, SQLite");
  });

  it("normalizes harmless spacing and casing differences in identity values", () => {
    const result = consolidateImportCandidates([
      candidate({ experienceIdentity: identity({ project: " 주문 플랫폼 ", role: " BACKEND ", period: "2024.01 - 2024.06" }) }),
      candidate({ experienceIdentity: identity({ role: "backend" }), action: "캐시를 도입했다." }),
    ]);

    assert.equal(result.length, 1);
    assert.match(result[0].action, /캐시를 도입했다/);
  });

  it("keeps candidates separate when the project is explicitly different", () => {
    const result = consolidateImportCandidates([
      candidate(),
      candidate({ experienceIdentity: identity({ project: "정산 플랫폼" }) }),
    ]);

    assert.equal(result.length, 2);
  });

  it("keeps candidates separate when the role changes", () => {
    const result = consolidateImportCandidates([
      candidate(),
      candidate({ experienceIdentity: identity({ role: "테크 리드" }) }),
    ]);

    assert.equal(result.length, 2);
  });

  it("keeps candidates separate when periods are clearly distinct", () => {
    const result = consolidateImportCandidates([
      candidate(),
      candidate({ experienceIdentity: identity({ period: "2025.01-2025.06" }) }),
    ]);

    assert.equal(result.length, 2);
  });

  it("preserves project and role component boundaries when identities are similar", () => {
    const result = consolidateImportCandidates([
      candidate({ experienceIdentity: identity({ project: "주문 API", role: "개발자" }) }),
      candidate({ experienceIdentity: identity({ project: "주문", role: "API 개발자" }) }),
    ]);

    assert.equal(result.length, 2);
  });

  it("merges candidates when every unavailable boundary uses the same unknown marker", () => {
    const unknown = identity({ project: "미상", period: "미상" });
    const result = consolidateImportCandidates([
      candidate({ experienceIdentity: unknown }),
      candidate({ experienceIdentity: unknown, action: "캐시를 도입했다." }),
    ]);

    assert.equal(result.length, 1);
  });

  it("unions review fields and only verifies merged evidence when every quote was verified", () => {
    const result = consolidateImportCandidates([
      candidate({ needsReview: ["learned"] }),
      candidate({
        action: "배포 절차를 자동화했다.",
        needsReview: ["resultMetrics"],
        sourceQuote: "배포 절차를 자동화했다.",
        sourceQuoteVerified: false,
      }),
    ]);

    assert.equal(result[0].sourceQuoteVerified, false);
    assert.deepEqual(result[0].needsReview, ["resultMetrics", "learned"]);
    assert.match(result[0].sourceQuote, /주문 API를 개선했다/);
    assert.match(result[0].sourceQuote, /배포 절차를 자동화했다/);
  });

  it("preserves distinct titles and marks merged context for review", () => {
    const result = consolidateImportCandidates([
      candidate({ title: "주문 API 구현" }),
      candidate({ title: "주문 장애 대응", situation: "장애 탐지가 늦었다." }),
    ]);

    assert.equal(result[0].title, "주문 API 구현 / 주문 장애 대응");
    assert.deepEqual(result[0].needsReview, ["title", "situation"]);
  });

  it("preserves distinct content across every mergeable card field", () => {
    const result = consolidateImportCandidates([
      candidate({
        situation: "첫 상황",
        role: "첫 역할",
        action: "첫 행동",
        resultMetrics: "첫 성과",
        learned: "첫 배움",
        evidenceSentence: "첫 증거",
        claimable: "첫 주장",
        notClaimable: "첫 경계",
        tags: "첫 태그",
      }),
      candidate({
        situation: "둘째 상황",
        role: "둘째 역할",
        action: "둘째 행동",
        resultMetrics: "둘째 성과",
        learned: "둘째 배움",
        evidenceSentence: "둘째 증거",
        claimable: "둘째 주장",
        notClaimable: "둘째 경계",
        tags: "둘째 태그",
      }),
    ]);

    const fields = [
      "situation",
      "role",
      "action",
      "resultMetrics",
      "learned",
      "evidenceSentence",
      "claimable",
      "notClaimable",
      "tags",
    ] as const;
    fields.forEach((field) => {
      assert.match(result[0][field], /첫/);
      assert.match(result[0][field], /둘째/);
    });
  });

  it("downgrades a concatenation of individually verified quotes to manual review", () => {
    const result = consolidateImportCandidates([
      candidate(),
      candidate({ sourceQuote: "Redis 캐시를 도입했다.", sourceQuoteVerified: true }),
    ]);

    assert.equal(result[0].sourceQuoteVerified, false);
  });

  it("removes transient experience identity from finalized response cards", () => {
    const result = finalizeImportCandidates([candidate()]);

    assert.equal("experienceIdentity" in result[0], false);
  });
});

describe("mergeSelectedImportCandidates", () => {
  it("replaces selected candidates at the first selected position and leaves others untouched", () => {
    const untouched = candidate({
      title: "별도 프로젝트",
      experienceIdentity: identity({ project: "별도" }),
      selected: false,
    });
    const result = mergeSelectedImportCandidates([
      candidate({ title: "첫 카드", selected: true }),
      untouched,
      candidate({ title: "두 번째 카드", action: "캐시를 도입했다.", selected: true }),
    ]);

    assert.equal(result.mergedCount, 2);
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].title, "첫 카드 / 두 번째 카드");
    assert.equal(result.candidates[0].selected, true);
    assert.ok(result.candidates[0].needsReview.includes("title"));
    assert.match(result.candidates[0].action, /주문 API를 개선했다/);
    assert.match(result.candidates[0].action, /캐시를 도입했다/);
    assert.equal(result.candidates[1], untouched);
  });

  it("does nothing unless at least two candidates are selected", () => {
    const input = [candidate({ selected: true }), candidate({ selected: false })];
    const result = mergeSelectedImportCandidates(input);

    assert.equal(result.mergedCount, 0);
    assert.deepEqual(result.candidates, input);
  });
});
