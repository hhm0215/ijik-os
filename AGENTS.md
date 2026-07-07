<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 이직 OS (ijik-os)

경험 뱅크 기반 개인 지원 전략 도구. 채용 공고를 넣으면 내가 미리 작성한 경험 카드에서만 지원 자료를 재구성하고, 근거가 부족하면 되묻는다.

설계 문서(승인됨): `~/.gstack/projects/Dev/hanhyemin-unknown-design-20260707-081038.md`

## 절대 원칙 — AI 저작권 경계

**AI는 사용자의 경험/생각을 창조하지 않는다.** AI는 편집자 + 인터뷰어다.

- 모든 AI 생성 문장은 경험 카드 출처가 필수. DB CHECK 제약(`draft_sentences`: type='ai'면 primary_source_card_id NOT NULL)으로 강제된다. 이 제약을 우회하는 코드를 쓰지 말 것.
- 근거 없는 요구사항 → 문장을 만들지 말고 되묻기(askback) 질문을 생성.
- 약한 근거 → 문장 생성 + "근거 약함" 경고 + 되묻기 병행.
- 생성된 문장은 출처 카드의 "주장해도 되는 것(claimable)" 범위를 넘으면 안 됨 (2차 정합성 검증).

## 스택 & 구조

- Next.js 16 (App Router) + TypeScript + Tailwind — `params`는 Promise, 라우트 핸들러는 Web Request/Response
- SQLite (`data/app.db`, gitignored) + Drizzle ORM (`src/db/`)
- LLM은 `src/lib/llm.ts` 추상화를 통해서만 호출한다 (직접 SDK/fetch 호출 금지):
  - `ANTHROPIC_API_KEY` 있으면 Claude(`claude-opus-4-8`), 없으면 Ollama 로컬 모델(기본 `qwen3:8b`, `OLLAMA_MODEL`로 변경)
  - 두 경로 모두 zod 스키마 기반 구조화 출력 (Claude: `messages.parse`, Ollama: `format` 파라미터)
  - 사용자는 유료 API 미사용 — 기본 경로는 Ollama. 로컬 8B 모델 품질 한계로 인한 이슈는 프롬프트 단순화/호출 분할로 대응
- LLM 파이프라인: `src/lib/pipeline/` (요구사항 추출 → 매칭/적합도 → 초안 → 되묻기 → 면접 질문)

## 명령어

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run db:push      # 스키마 변경을 SQLite에 반영 (drizzle-kit push)
npm run build        # 프로덕션 빌드
```

## 작업 방식 (하혜민과의 합의)

- **MVP는 Claude가 구성, 하혜민이 실사용 → 피드백으로 반복 개선.**
- 아이디어/불편사항은 `IDEAS.md`에 계속 기록한다. 세션 시작 시 `IDEAS.md`를 읽고 status가 `open`인 항목을 확인할 것. 반영한 항목은 `done`, 안 하기로 한 건 `dropped`로 표시하고 이유를 남긴다.
- 단계 확장 순서는 설계 문서를 따른다: 1단계 붙여넣기 코어 → 2단계 원티드 자동 수집 → 3단계 나머지 소스/알림/대시보드. 앞 단계 검증 전에 뒷 단계를 만들지 말 것.
- 서비스화 가능성 유지: 사용자 데이터 하드코딩 금지, DB 접근은 `src/db/` 레이어로 분리 유지.
