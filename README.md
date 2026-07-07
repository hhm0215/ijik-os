# 이직 OS

경험 뱅크 기반 개인 지원 전략 도구. 채용 공고를 붙여넣으면 내가 미리 작성한 경험 카드에서만 지원 자료를 재구성하고, 근거가 부족하면 되묻는다.

**핵심 원칙: AI는 작가가 아니라 편집자 + 인터뷰어다.** 모든 AI 생성 문장은 경험 카드 출처가 필수(DB CHECK 제약으로 강제), 근거 없는 요구사항에는 문장 대신 되묻기 질문이 생성된다.

## 시작하기

```bash
# 1. 로컬 LLM 준비 (최초 1회, 무료)
brew install ollama
brew services start ollama
ollama pull qwen3:8b

# 2. 실행
npm install
npm run db:push   # 최초 1회 — SQLite 스키마 생성
npm run dev       # http://localhost:3000
```

Claude API 키가 있으면 `.env.local`에 `ANTHROPIC_API_KEY`를 넣으세요 — 자동으로 Claude를 사용해요 (품질↑, 유료). 없으면 Ollama 로컬 모델로 동작해요 (무료, 데이터가 기기 밖으로 안 나감). 자세한 옵션은 `.env.local.example` 참고.

## 사용 흐름

1. **경험 뱅크**에 경험 카드를 작성한다 (상황/역할/행동/수치/주장해도 되는 것).
2. **공고 피드**에서 채용 공고 본문을 붙여넣는다 → 분석 시작 (1~3분).
3. **공고 상세**에서 확인: 요구사항 분해+매칭 / 적합도 breakdown+출처 달린 초안 / 되묻기 질문.
4. 되묻기에 답하면 새 경험 카드로 저장 → "다시 분석"하면 초안에 반영.

## 구조

- Next.js 16 (App Router) + TypeScript + Tailwind
- SQLite (`data/app.db`) + Drizzle ORM — 스키마: `src/db/schema.ts`
- LLM: Ollama 로컬 모델(기본) 또는 Claude API — 추상화: `src/lib/llm.ts`, 파이프라인: `src/lib/pipeline/run.ts`

자세한 규칙과 로드맵은 `AGENTS.md`, 아이디어/피드백은 `IDEAS.md`에 기록.
