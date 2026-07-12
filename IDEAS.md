# IDEAS — 아이디어 / 피드백 로그

쓰다가 떠오르는 아이디어, 불편한 점을 여기에 계속 기록한다. 형식은 자유지만 아래 틀을 권장.
Claude는 세션 시작 시 이 파일을 읽고 `open` 항목을 확인한다.

형식: `- [status] (날짜) 내용` — status: open / in-progress / done / dropped

## 피드백 (실사용 중 불편한 점)

_(아직 없음 — MVP 사용 후 기록)_

## 로컬 모델(qwen3:8b) 품질 관찰 — 첫 E2E 테스트 (2026-07-07)

- [done] (2026-07-11) 적합도 점수 인플레이션: 채점 프롬프트에 근거 강도별 점수 구간 + notClaimable 감점 규칙 명시로 수정. Mac E2E 검증 통과 — 공고 2 재분석에서 domain 100→0 (notClaimable "결제 도메인" 감점 작동), overall 89→37. 후속 관찰은 아래 루브릭 튜닝 항목
- [done] (2026-07-11) 면접 질문이 3개만 생성됨 → 별도 LLM 호출로 분리(파이프라인 4호출) + "posting 최소 6개, weakness 정확히 3개" 명시. Mac E2E 검증 통과 — 6개(3/3) → 13개(posting 10, weakness 3)
- [open] (2026-07-11) **감점 후 점수-판정 정합성**: 수정 후 overall 37인데 verdict는 여전히 "지원 가치 있음". domain 0·impact 0으로 과감점됐을 가능성도 (100→0 스윙, 중간값 없음). 루브릭 튜닝(아이디어 백로그의 기존 항목)과 함께 실제 공고 여러 개로 보정 필요
- [open] (2026-07-11) **Windows Ollama 0.13.1에서 구조화 출력 실패**: 대형 스키마(analysisSchema) 호출 시 `failed to load model vocabulary required for format` + 서버 로그 `error parsing grammar: unexpected end of input`. 작은 스키마(추출)는 성공. Mac(0.31.1)에서는 재현 안 됨 — Windows Ollama 버전 업그레이드로 해결 시도가 1순위
- [done] (2026-07-12) **재분석 시 이전 결과 미정리 버그 수정**: persist에서 기존 결과 삭제(requirements/askbacks/drafts/interview, 자식은 FK cascade) + 신규 저장을 한 트랜잭션으로. requirements 사전 INSERT도 트랜잭션 안으로 이동. E2E 검증 — 중복 상태(req 13)에서 재분석 → req 6/matches 6/drafts 2로 리셋, 고아 행 0, 불변식 유지. 부수 효과 검증됨: LLM 호출 중 실패 시(Ollama 다운 케이스 실측) 이전 결과 완전 보존
- [open] (2026-07-12) **면접 질문 weakness 미생성 변동성**: 같은 프롬프트로 실행 간 posting 10/weakness 3 → posting 7/weakness 0. "weakness 정확히 3개" 지시를 로컬 8B가 간헐적으로 무시. qtype은 zod enum이라 스키마 문제 아님. 대응 후보: weakness 질문을 또 별도 호출로 분리, 또는 생성 후 개수 검증+재시도
- (2026-07-12) 관찰: 중복 오염 제거 후 재분석에서 fit이 tech 95/domain 45/collab 65/impact 60/overall 65 — domain이 "notClaimable이면 49 초과 불가" 규칙 안(45)에 정확히 들어왔고 verdict("지원 가치 있음")와 점수(65)의 정합성도 자연스러움. 직전 관찰(domain 0, overall 37 vs 긍정 verdict)은 중복 입력 오염 영향이었을 가능성. 루브릭 튜닝 항목은 실제 공고 추가 후 재평가
- 잘 되는 것: 요구사항 분해/분류 정확, weak 근거 → 되묻기 생성, over_claim 검증이 실제로 과장 문장을 잡아냄, 출처 없는 AI 문장 0건. 분석 1회 약 6분 (첫 로딩 포함)

## 아이디어 백로그 (설계 문서에서 이월)

- [open] (2026-07-07) 2단계: 원티드 공고 자동 수집 → 같은 DB 유입 + 적합도순 피드
- [open] (2026-07-07) 3단계: 잡코리아/사람인 수집
- [open] (2026-07-07) 3단계: 링크드인 공고 알림 이메일 파싱 (직접 크롤링 금지)
- [open] (2026-07-07) 3단계: 텔레그램 알림 (신규 고적합 공고 + 초안 준비됨)
- [open] (2026-07-07) 3단계: 지원 현황 대시보드 + 결과 피드백 루프 (어떤 카드가 통과로 이어졌나)
- [open] (2026-07-07) 3단계: 자소서 문항별 답변 (문항을 requirement처럼 취급, 같은 엔진)
- [open] (2026-07-07) 적합도 루브릭/가중치 튜닝 — 실제 공고 몇 개 돌려본 뒤
- [open] (2026-07-07) 로컬 8B 모델 품질이 부족하면: 분석 호출을 더 잘게 분할(매칭/초안/면접 따로), 프롬프트 단순화, 또는 exaone3.5:7.8b(한국어 특화)·qwen3:14b 비교 테스트

## 공개 준비 (GitHub public 전에)

- [done] (2026-07-07) docs/DEPLOY.md의 Basic Auth 예시 계정명 → `<사용자명>` 플레이스홀더로
- [done] (2026-07-07) README.md 보강 — 저작권 3중 강제 표, 배포 섹션, 문서 링크 추가
- [done] (2026-07-07) 이름은 유지하기로 결정 (본인 계정 공개 저장소 + 포트폴리오), 로컬 경로(`~/.gstack/...`) 참조는 제거
- [done] (2026-07-07) `gh repo create ijik-os --public --source . --push`로 공개

## 운영/서비스화 대비

- [open] (날짜 미정 — 전환 트리거 충족 시) Postgres + `users`/`user_id` + 인증 한 번에 도입. 설계 방침은 PLAN.md §4.1

## 배포 관련

- [open] (2026-07-07) 기존 DB에 대한 스키마 마이그레이션 자동 적용 — 지금은 빈 DB만 자동 초기화. 스키마가 바뀌기 시작하면 drizzle migrate를 기존 DB에도 적용하는 체계 필요
- [open] (2026-07-07) VPS CPU 추론이 너무 느리면 qwen3:4b 테스트, 또는 "Mac에서 분석 + VPS는 조회용" 하이브리드 검토
- [open] (2026-07-07) DB 백업 cron 등록 (docs/DEPLOY.md §4 명령 참고)

## 열린 질문 (설계 문서에서 이월)

- [open] (2026-07-07) LLM 월 비용 상한 관리 방법
- [open] (2026-07-07) 링크드인 이메일 접근 방식 (IMAP vs Gmail API vs 포워딩) — 3단계 전 결정
