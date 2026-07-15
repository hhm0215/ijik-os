# 이직 OS

경험 뱅크 기반 개인 지원 전략 도구. 채용 공고를 붙여넣으면 내가 미리 작성한 경험 카드에서만 지원 자료를 재구성하고, 근거가 부족하면 되묻는다.

**핵심 원칙: AI는 작가가 아니라 편집자 + 인터뷰어다.** AI가 사람의 생각과 경험을 창조할 수는 없다 — 그래서 이 도구는 "그럴듯한 자소서 생성기"가 아니라, 내가 쓴 경험만 재구성하고 부족하면 나에게 묻는 구조로 설계됐다.

이 원칙은 프롬프트 한 줄이 아니라 3중으로 강제된다:

| 층 | 메커니즘 |
|---|---|
| 스키마 | AI 생성 문장은 출처 카드 ID가 NOT NULL + CHECK 제약 — 출처 없이는 DB에 저장 자체가 불가 |
| 파이프라인 | 근거 없는 요구사항 → 문장 대신 되묻기(askback) 생성. LLM이 지어낸 카드 ID는 코드에서 차단 |
| 2차 검증 | 생성 문장이 출처 카드의 "주장해도 되는 것" 범위를 넘으면 over_claim 경고 |

## 시작하기

```bash
# 1. 로컬 LLM 준비 (최초 1회, 무료)
brew install ollama
brew services start ollama
ollama pull qwen3:8b

# 2. 실행
npm install
cp .env.local.example .env.local
# .env.local의 로그인 비밀값·소유자 이메일·초기 설정 코드를 실제 값으로 교체
npm run db:migrate   # 커밋된 SQLite 마이그레이션 적용
npm run dev       # http://localhost:3000
```

Claude API 키가 있으면 `.env.local`에 `ANTHROPIC_API_KEY`를 넣으세요 — 자동으로 Claude를 사용해요 (품질↑, 유료). 없으면 Ollama 로컬 모델로 동작해요 (무료, 데이터가 기기 밖으로 안 나감). 자세한 옵션은 `.env.local.example` 참고.

처음 실행하면 `/setup`에서 `OWNER_EMAIL`의 소유자 계정을 하나만 만든다. 화면에는
`OWNER_SETUP_TOKEN`과 12자 이상의 새 비밀번호를 입력한다. 공개 회원가입은 비활성화되어
있으며, 초기 설정이 끝난 뒤에는 설정 코드를 비워도 된다. `BETTER_AUTH_SECRET`은 세션
서명에 쓰이므로 운영 중 임의로 바꾸지 않는다.

스키마를 변경할 때는 `npm run db:generate`로 SQL을 만들고 검토한 뒤
`npm run db:migrate`로 적용한다. `db:push`는 폐기 가능한 로컬 DB의 빠른 실험에만 쓰고,
운영 DB에는 사용하지 않는다.

### 로컬 품질 게이트

```bash
npm test
npm run lint
npm run build
# 앱과 Ollama 실행 후, 저장 없이 경험 분할·병합 실제 모델 회귀 평가
npm run eval:card-import
```

빠른 정책·입력 경계는 TypeScript 단위 테스트로 검증한다. 실제 LLM 결과 품질은 경험
가져오기의 `eval:card-import`와 같은 공고를 재분석하는 `pipeline-eval` 절차로 나눠 검증한다.

## 사용 흐름

1. **경험 뱅크**에 직접 카드를 작성하거나, 이력서·자소서·포트폴리오 문서에서 경험 후보를 가져온다.
2. **공고 피드**에서 채용 공고 본문을 붙여넣는다 → 분석 시작 (로컬 qwen3:8b 기준 약 6분, VPS CPU 환경은 20분~1시간 소요 가능).
3. **공고 상세**에서 확인: 요구사항 분해+매칭 / 적합도 breakdown+출처 달린 초안 / 되묻기 질문.
4. 되묻기에 답하면 새 경험 카드로 저장 → "다시 분석"하면 초안에 반영.

## 구조

- Next.js 16 (App Router) + TypeScript + Tailwind
- SQLite (`data/app.db`, 저장소에 포함되지 않음) + Drizzle ORM — 스키마: `src/db/schema.ts`
- Better Auth — 이메일·비밀번호 기반 단일 소유자 로그인, DB 세션, 공개 가입 차단
- LLM: Ollama 로컬 모델(기본) 또는 Claude API — 추상화: `src/lib/llm.ts`, 파이프라인: `src/lib/pipeline/run.ts`
- 파이프라인 5단계: 요구사항 추출 → 매칭·적합도·초안·되묻기 → 면접 질문(posting/weakness 분리) → 저작권 2차 검증 → 트랜잭션 저장. 두 LLM 경로 모두 zod 스키마 기반 구조화 출력

## 서버 배포 (선택)

Docker Compose 구성이 포함되어 있다 (`docker-compose.yml` — 앱 + Ollama):

```bash
cp .env.local.example .env
# .env에서 BETTER_AUTH_URL을 실제 HTTPS 주소로 바꾸고 비밀값을 새로 생성
docker compose up -d --build
docker compose exec ollama ollama pull qwen3:8b
```

앱은 `127.0.0.1:3400`에만 바인딩된다. 경험 뱅크는 민감한 개인 데이터이므로 HTTPS
리버스 프록시를 사용하고, 앱 로그인을 실제로 확인하기 전까지 Basic Auth를 반드시
유지한다. 개인 배포에서는 로그인 확인 뒤에도 방어층으로 유지하는 편을 권장한다.
VPS 배포·백업·마이그레이션 절차는 [docs/DEPLOY.md](docs/DEPLOY.md).

현재 인증은 **한 명이 하나의 SQLite 데이터 전체를 사용하는 개인 배포용 접근 제어**다.
경험 카드와 공고에 `user_id`를 붙인 멀티테넌트 구조가 아니므로 두 번째 계정을 만들면
안 된다. 타인에게 서비스를 여는 SaaS 전환 시에는 기존 설계 방침대로 Postgres,
전 테이블의 `user_id`, 소유권 검사와 데이터 이관을 한 작업으로 도입한다.

## 문서

- [docs/PLAN.md](docs/PLAN.md) — 비전, 설계 원칙, 로드맵, 결정 로그
- [docs/DEPLOY.md](docs/DEPLOY.md) — VPS 배포 가이드
- [docs/WINDOWS.md](docs/WINDOWS.md) — Windows에서 최신 세션 이어서 개발하기
- [docs/HARNESS.md](docs/HARNESS.md) — 이 프로젝트를 교재로 한 AI 하네스 엔지니어링 학습 노트
- `AGENTS.md` — AI 개발 협업 규칙, `IDEAS.md` — 아이디어/피드백 큐
