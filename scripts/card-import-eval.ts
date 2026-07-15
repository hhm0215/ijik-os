import assert from "node:assert/strict";

const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const source = `경력 문서

프로젝트: 주문 플랫폼 고도화
기간: 2024.01~2024.06
역할: 백엔드 개발자
업무 1: 주문 API의 N+1 쿼리를 개선했다.
업무 2: Redis 캐시를 도입했다.
업무 3: 장애 알림 대시보드를 구축했다.
성과 1: 평균 응답 시간을 800ms에서 250ms로 줄였다.
성과 2: 장애 탐지 시간을 20분에서 5분으로 줄였다.

프로젝트: 정산 플랫폼 구축
기간: 2024.07~2024.12
역할: 백엔드 개발자
업무: 일별 정산 배치와 재처리 기능을 구현했다.
성과: 정산 처리 시간을 2시간에서 20분으로 줄였다.

프로젝트: 고객 상담 자동화
전체 기간: 2023.01~2023.12
2023.01~2023.06 역할: 백엔드 개발자
업무: 상담 이력 조회 API를 구현했다.
2023.07~2023.12 역할: 테크 리드로 명확히 변경
업무: 기술 의사결정과 코드 리뷰를 총괄했다.

프로젝트: 서버 모니터링 도구 (서로 독립된 두 차수)
1차 기간: 2021.01~2021.03
역할: 백엔드 개발자
업무: 서버 자원 수집 모듈을 구현했다.
1차 프로젝트 종료 후 3년간 활동이 없었다.
2차 기간: 2024.01~2024.03
역할: 백엔드 개발자
업무: 별도 2차 프로젝트로 알림 규칙 엔진을 재구축했다.`;

type Card = {
  title: string;
  situation: string;
  role: string;
  action: string;
  resultMetrics: string;
  [key: string]: unknown;
};

async function storedCardIds(): Promise<number[]> {
  const response = await fetch(`${appUrl}/api/cards`);
  assert.equal(response.ok, true, `카드 조회 실패: ${response.status}`);
  const cards = (await response.json()) as { id: number }[];
  return cards.map((card) => card.id);
}

function searchable(card: Card): string {
  return Object.values(card).join(" ");
}

function assertContains(card: Card, terms: RegExp[]): void {
  const value = searchable(card);
  terms.forEach((term) => assert.match(value, term));
}

function findSingleCard(cards: Card[], label: string, terms: RegExp[]): Card {
  const matches = cards.filter((card) => {
    const value = searchable(card);
    return terms.every((term) => term.test(value));
  });
  assert.equal(matches.length, 1, `${label} 후보는 정확히 한 장이어야 합니다.`);
  return matches[0];
}

async function main(): Promise<void> {
  const beforeIds = await storedCardIds();
  const formData = new FormData();
  formData.set("text", source);

  const response = await fetch(`${appUrl}/api/cards/import`, {
    method: "POST",
    body: formData,
  });
  const result = (await response.json()) as { cards?: Card[]; error?: string };
  assert.equal(response.ok, true, result.error ?? `가져오기 실패: ${response.status}`);

  const cards = result.cards ?? [];
  assert.equal(cards.length, 6, "같은 경험은 합치고 프로젝트·역할·기간 경계만 나눠야 합니다.");

  const orderCard = findSingleCard(cards, "주문 프로젝트", [/N\+1/i, /Redis/i, /대시보드/]);
  const settlementCard = findSingleCard(cards, "정산 프로젝트", [/정산/, /재처리/]);
  const counselorBackendCard = findSingleCard(cards, "상담 백엔드 역할", [/상담 이력/, /API/i]);
  const counselorLeadCard = findSingleCard(cards, "상담 테크 리드 역할", [/기술 의사결정/, /코드 리뷰/]);
  const monitoringFirstCard = findSingleCard(cards, "모니터링 1차 기간", [/자원 수집/, /모듈/]);
  const monitoringSecondCard = findSingleCard(cards, "모니터링 2차 기간", [/알림 규칙/, /엔진/]);

  assert.equal(
    new Set([
      orderCard,
      settlementCard,
      counselorBackendCard,
      counselorLeadCard,
      monitoringFirstCard,
      monitoringSecondCard,
    ]).size,
    6,
    "명확히 다른 프로젝트·역할·기간은 서로 다른 카드여야 합니다."
  );

  assertContains(orderCard, [/N\+1/i, /Redis/i, /대시보드/, /800/, /250/, /20/, /5/]);
  assertContains(settlementCard, [/일별/, /재처리/, /2시간/, /20분/]);
  cards.forEach((card) => assert.equal("experienceIdentity" in card, false));

  const afterIds = await storedCardIds();
  assert.deepEqual(afterIds, beforeIds, "후보 생성 요청은 경험 카드를 저장하면 안 됩니다.");

  console.log(`card import eval passed: ${cards.length} candidates, stored cards unchanged (${afterIds.length})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
