# PROGRESS — 진행 로그

> **규칙:** Claude는 세션 시작 시 이 파일과 [IDEAS.md](../IDEAS.md)의 open 항목을 읽고, 의미 있는 작업을 마친 세션 끝에 아래 로그를 한 블록 추가한다 (`/wrap-session` 스킬 사용). 현재 상태 표는 항상 최신으로 유지.

## 현재 상태

- **단계:** 1.5단계 (품질 안정화) — 로드맵은 [PLAN.md](./PLAN.md) §6
- **다음 마일스톤:** 품질 수정 2건 E2E 검증 완료 → VPS 배포 (RAM 8GB 확인됨, Ollama 유지·Claude API 안 씀) → 실사용
- **차단 요소:** Windows 로컬에서 Ollama 구조화 출력 오류로 E2E 검증 불가 (IDEAS 참고). Mac에서 검증하거나 이슈 해결 필요
- **실행 방법:** `npm run dev` (Mac: Ollama brew 서비스 / Windows: Ollama 앱)

## 세션 로그

### 2026-07-11 — 품질 이슈 2건 수정 (Windows 새 환경, E2E 검증 보류)

- 한 것: (1) 적합도 인플레이션 수정 — 분석 프롬프트에 근거 강도별 점수 구간(strong 80~100 / medium 50~79 / weak 20~49 / 없음 0~19)과 notClaimable 해당 요구사항 감점 규칙 명시. (2) 면접 질문 부족 수정 — 면접 질문 생성을 별도 LLM 호출로 분리(`interviewSchema` 신설, 파이프라인이 3→4호출), posting 최소 6개·weakness 정확히 3개 명시. 타입 체크·프로덕션 빌드 통과
- 환경: 이 세션은 Windows 새 클론 환경 — npm install, Ollama 설치 확인, qwen3:8b 다운로드(5.2GB), 수정 검증용 테스트 데이터 투입(결제 도메인 notClaimable 카드 2장 + 결제 요구 공고 1건)
- 막힌 것: Windows Ollama 0.13.1이 대형 스키마 구조화 출력에서 grammar 파싱 오류로 500 반환 → E2E 검증 못 함. 재분석 시 requirements 중복 누적 버그도 발견. 둘 다 IDEAS에 기록
- 확인된 것: VPS는 RAM 8GB (DEPLOY.md 가정과 일치), Claude API는 안 쓰기로 — VPS도 Ollama 경로
- 다음: (1) Mac에서 또는 Ollama 이슈 해결 후 pipeline-eval로 수정 2건 검증 (domain ≤49, posting 질문 ≥6) → IDEAS를 done으로, (2) 재분석 정리 버그 수정, (3) VPS 배포 (SSH 접속 정보 필요)

### 2026-07-07 — 운영 대비 DB 설계 방침 + 공개 준비 점검

- 한 것: git 상태 확인(리모트 없음, 로컬 커밋 5개 — 오류 아님), public 공개 대비 민감 정보 점검(DB/env 커밋 이력 전무, 코드 깨끗), 운영 단계 DB 논의 → "1인 기준 유지 + 마이그레이션 대비 설계" 합의를 PLAN.md §4.1로 문서화
- 결정: SQLite 유지, 전환 트리거(타인 공개 or 쓰기 급증) 충족 시 Postgres+user_id+인증 일괄 도입. 저장소는 public 방향
- 이어서 공개 완료: 공개 준비 4항목 처리(계정명 플레이스홀더, README 보강, 이름 유지 결정+로컬 경로 정리) → **https://github.com/hhm0215/ijik-os 공개 push 완료**
- 다음: VPS에서 DEPLOY.md 절차 실행 (clone → docker compose up → 모델 pull → 리버스 프록시+Basic Auth)

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
