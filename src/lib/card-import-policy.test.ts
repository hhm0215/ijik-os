import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CARD_IMPORT_SYSTEM_PROMPT,
  cardBatchSchema,
  isSourceQuoteVerified,
} from "./card-import-policy";

const validCard = {
  title: " 결제 장애 대응 ",
  situation: " 장애가 발생했다 ",
  role: " 백엔드 담당 ",
  action: " 원인을 찾아 복구했다 ",
};

describe("isSourceQuoteVerified", () => {
  it("accepts an exact source excerpt after harmless formatting normalization", () => {
    const source = "성과: “Payment API 장애를 20분 안에 복구했습니다.”";
    const quote = "ＰＡＹＭＥＮＴ API 장애를 20분 안에 복구했습니다.";

    assert.equal(isSourceQuoteVerified(source, quote), true);
  });

  it("rejects a quote that was not present in the uploaded source", () => {
    assert.equal(
      isSourceQuoteVerified("배포 자동화를 구축했습니다.", "매출을 30% 늘렸습니다."),
      false
    );
  });

  it("rejects excerpts that are too short to be meaningful evidence", () => {
    assert.equal(isSourceQuoteVerified("장애 복구 완료", "장애 복구"), false);
  });
});

describe("cardBatchSchema", () => {
  it("trims stored fields, supplies optional defaults, and strips UI metadata", () => {
    const result = cardBatchSchema.parse({
      cards: [{ ...validCard, selected: true, sourceQuote: "원문" }],
    });

    assert.deepEqual(result.cards[0], {
      title: "결제 장애 대응",
      situation: "장애가 발생했다",
      role: "백엔드 담당",
      action: "원인을 찾아 복구했다",
      resultMetrics: "",
      learned: "",
      evidenceSentence: "",
      claimable: "",
      notClaimable: "",
      tags: "",
    });
  });

  it("rejects the entire batch when one card lacks a required field", () => {
    const result = cardBatchSchema.safeParse({
      cards: [validCard, { ...validCard, situation: "   " }],
    });

    assert.equal(result.success, false);
  });

  it("requires between one and twelve cards", () => {
    assert.equal(cardBatchSchema.safeParse({ cards: [] }).success, false);
    assert.equal(
      cardBatchSchema.safeParse({ cards: Array.from({ length: 12 }, () => validCard) })
        .success,
      true
    );
    assert.equal(
      cardBatchSchema.safeParse({ cards: Array.from({ length: 13 }, () => validCard) })
        .success,
      false
    );
  });
});

describe("CARD_IMPORT_SYSTEM_PROMPT split and merge policy contract", () => {
  it("requires one card for the same project, role, and period", () => {
    assert.match(
      CARD_IMPORT_SYSTEM_PROMPT,
      /같은 프로젝트·같은 역할·같은 기간의 내용은 반드시 하나의 경험 카드로 통합/
    );
  });

  it("forbids splitting merely because there are multiple duties or results", () => {
    assert.match(
      CARD_IMPORT_SYSTEM_PROMPT,
      /업무 항목이나 성과가 여러 개라는 사실은 분리 근거가 아니다/
    );
  });

  it("allows splitting only for an explicit project, role, or period boundary", () => {
    assert.match(
      CARD_IMPORT_SYSTEM_PROMPT,
      /별도 프로젝트가 명확하거나, 역할 변경이 명시됐거나, 기간 구분이 명확할 때만/
    );
  });

  it("merges instead of splitting when the boundary is ambiguous", () => {
    assert.match(
      CARD_IMPORT_SYSTEM_PROMPT,
      /분리 경계가 불명확하면 나누지 말고 하나의 카드로 통합/
    );
  });

  it("uses structured identity values and a canonical marker for unknown boundaries", () => {
    assert.match(CARD_IMPORT_SYSTEM_PROMPT, /experienceIdentity의 project\/role\/period/);
    assert.match(CARD_IMPORT_SYSTEM_PROMPT, /문서에 없는 식별 항목은 추정하지 말고 정확히 '미상'/);
  });
});
