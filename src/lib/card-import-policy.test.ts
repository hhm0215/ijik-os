import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardBatchSchema, isSourceQuoteVerified } from "./card-import-policy";

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
