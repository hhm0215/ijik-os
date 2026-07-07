# PROGRESS — 진행 로그

> **규칙:** Claude는 세션 시작 시 이 파일과 [IDEAS.md](../IDEAS.md)의 open 항목을 읽고, 의미 있는 작업을 마친 세션 끝에 아래 로그를 한 블록 추가한다 (`/wrap-session` 스킬 사용). 현재 상태 표는 항상 최신으로 유지.

## 현재 상태

- **단계:** 1.5단계 (품질 안정화) — 로드맵은 [PLAN.md](./PLAN.md) §6
- **다음 마일스톤:** 하혜민이 실제 카드/공고로 1주 실사용 → 피드백 수집 → 2단계 진입 판단
- **차단 요소:** 없음
- **실행 방법:** `npm run dev` (Ollama가 brew 서비스로 상시 실행 중)

## 세션 로그

### 2026-07-07 — VPS 배포 준비 (Docker Compose)

- 한 것: Dockerfile(멀티스테이지 standalone) + docker-compose.yml(앱+Ollama, 127.0.0.1 바인딩) + docs/DEPLOY.md(호스팅어 VPS 가이드, 리버스 프록시+Basic Auth 예시, 스왑/백업). drizzle 마이그레이션 생성 — 빈 DB 첫 기동 시 스키마 자동 적용
- 확인된 것: 로컬 Docker 빌드/기동/DB 자동 초기화/카드 생성 정상
- 주의: VPS는 CPU 추론이라 분석이 20분~1시간 걸릴 수 있음. 보안상 리버스 프록시+인증 없이 공개 금지
- 다음: 하혜민이 GitHub 저장소 push → VPS에서 DEPLOY.md 절차 실행

### 2026-07-07 — MVP 구축 + 로컬 LLM 전환 (커밋 9e4ec1d, 6dc7b3d)

- 한 것: 설계 문서 1단계 전체 구현 (카드 CRUD, 분석 파이프라인, 3열 상세 화면), Ollama 전환 및 E2E 검증
- 확인된 것: 출처 강제 3중 방어가 실제로 작동 (CHECK 제약 거부, 되묻기 생성, over_claim 검출). 분석 1회 약 6분
- 발견된 이슈: 적합도 인플레이션, 면접 질문 3개만 생성 → IDEAS.md에 open으로 기록
- 다음: 실사용 피드백 대기, 채점 프롬프트에 notClaimable 감점 규칙 추가 검토
