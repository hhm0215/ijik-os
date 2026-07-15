# HARNESS.md — 하네스 엔지니어링 학습 가이드

> 이 프로젝트 자체가 교재다. "하네스 엔지니어링"이란 AI 개발 에이전트(Codex·Claude Code 등)가
> 일관되게 좋은 결과를 내도록 **컨텍스트, 규칙, 도구, 권한을 설계**하는 일이다.
> 모델을 바꾸는 게 아니라, 모델이 일하는 환경을 설계한다.

## 1. 이 프로젝트의 하네스 지도

```
ijik-os/
├── CLAUDE.md              # 진입점 — @AGENTS.md를 임포트만 한다
├── AGENTS.md              # 프로젝트 규칙의 정본 (원칙·스택·작업 방식)
├── IDEAS.md               # 아이디어/피드백 큐 (open → done/dropped)
├── docs/
│   ├── PLAN.md            # 무엇을 왜 만드는가 (비전·로드맵·결정 로그)
│   ├── PROGRESS.md        # 어디까지 왔는가 (세션 로그)
│   └── HARNESS.md         # 이 파일
└── .claude/
    ├── settings.json      # 권한 allowlist — 에이전트가 확인 없이 할 수 있는 일의 경계
    └── skills/            # 프로젝트 전용 스킬 (반복 워크플로우의 절차서)
        ├── run-app/
        ├── pipeline-eval/
        └── wrap-session/
```

## 2. 각 조각이 하는 일 (하네스의 4대 요소)

### ① 컨텍스트 주입 — CLAUDE.md / AGENTS.md

Claude Code는 세션 시작 시 프로젝트 루트의 `CLAUDE.md`를 자동으로 읽고, 다른 개발
에이전트도 `AGENTS.md`를 프로젝트 규칙의 정본으로 사용한다.
`@경로` 문법으로 다른 파일을 임포트할 수 있다 (우리는 `@AGENTS.md`).

**설계 포인트:**
- 항상 필요한 것만 넣는다 (원칙, 스택, 명령어, 작업 규칙). 컨텍스트는 유한한 자원
- 가끔 필요한 건 별도 파일로 빼고 "언제 읽어라"만 적는다 — 우리의 PLAN/PROGRESS/IDEAS 패턴
- **규칙은 위치가 아니라 참조로 발견되게 한다.** AGENTS.md의 "세션 시작 시 IDEAS.md open 항목 확인" 같은 한 줄이, 파일 전체를 매번 읽는 것보다 싸다

### ② 절차 지식 — Skills (`.claude/skills/`)

스킬 = `SKILL.md` 하나가 든 폴더. frontmatter의 `name`/`description`만 항상 로드되고,
본문은 스킬이 호출될 때만 로드된다 (**점진적 공개** — 컨텍스트 절약의 핵심 패턴).

```markdown
---
name: my-skill
description: 언제 이 스킬을 쓰는지 — Claude가 이 문장을 보고 자동 판단한다
---
(호출됐을 때만 읽히는 상세 절차)
```

**설계 포인트:**
- description이 전부다. "무엇을 한다"가 아니라 **"언제 쓴다"**를 적어야 자동 발동한다
- 좋은 스킬 후보: 2번 이상 반복했고, 매번 같은 절차이고, 빠뜨리면 사고 나는 것
- 사용자는 `/run-app`처럼 슬래시로 직접 호출할 수도 있다

### ③ 권한 경계 — `.claude/settings.json`

에이전트가 물어보지 않고 실행할 수 있는 것(allow)과 절대 못 하는 것(deny)을 선언한다.
이 파일은 git에 커밋되어 팀 전체에 적용된다 (개인용은 `settings.local.json`).

**설계 포인트:**
- 원칙: 읽기·빌드·테스트는 넓게 허용하고, 삭제·배포 같은 파괴적 작업은 확인을 요구한다. commit·push는 사용자가 승인한 검증 워크플로우 안에서만 자동화한다
- 우리 설정: npm/drizzle/sqlite3(로컬 DB 조회)/ollama와 검증된 작업 단위의 git commit·push는 자유, `data/` 삭제는 deny
- 권한을 넓힐수록 빨라지고, 좁힐수록 안전하다 — 이 트레이드오프 조절이 하네스 엔지니어링의 일상

커밋·푸시 허용은 무제한 배포 권한이 아니다. `wrap-session`의 lint/build/관련 E2E와 문서
갱신을 통과한 작업 단위에만 적용하고, VPS 배포는 별도의 릴리스 판단을 거친다.

2026-07-15에는 포트 3001의 별도 Vite 앱을 ijik-os로 오인할 뻔한 검증 사례를 반영해
`run-app`에 `/api/cards` JSON 정체 확인을 추가했다. 반복 명령뿐 아니라 실제 실패 사례를
절차의 방어선으로 환류하는 것도 하네스 유지보수다.

### ③-b 이벤트 자동화 — Hooks (`.claude/settings.json` + `.claude/hooks/`)

"세션 시작 때마다", "파일 저장 후마다" 같은 **이벤트 반응 자동화**는 메모리나 AGENTS.md 지시로는
보장이 안 된다 (모델이 잊거나 건너뛸 수 있음). 하네스가 직접 실행하는 **훅**으로 만들어야 한다.

**우리 설정:** `SessionStart` 훅 → `.claude/hooks/check-git-fresh.sh`
- 왜: Mac/Windows 두 머신을 오가며 작업하므로, 구버전 코드 위에서 세션을 시작하는 사고 방지
- 무엇을: 세션 시작 시 `git fetch` 후 origin/main 대비 뒤처짐/갈라짐을 검사, 뒤처졌으면
  사용자에게 경고(`systemMessage`)를 띄우고 모델 컨텍스트에도 주입(`additionalContext`)해서
  Claude가 git pull부터 제안하게 함. 최신이거나 오프라인이면 침묵
- 패턴: 훅 스크립트는 별도 파일로 커밋(양쪽 머신 공유), stdout에 JSON을 내면 하네스가 해석

### ④ 기억 — 세션을 넘는 상태

LLM은 세션이 끝나면 다 잊는다. 기억은 전부 **파일로 설계**해야 한다:

| 저장소 | 스코프 | 우리 프로젝트에서 |
|---|---|---|
| `~/.claude/.../memory/` | 사용자 전역 (Claude가 자동 관리) | 하혜민의 원칙·프로젝트 상태 요약 |
| `AGENTS.md` | 프로젝트 (git 커밋) | 불변에 가까운 규칙 |
| `docs/PROGRESS.md` | 프로젝트 (git 커밋) | 세션마다 갱신되는 진행 상태 |
| `IDEAS.md` | 프로젝트 (git 커밋) | 할 일/피드백 큐 |

**설계 포인트:** "어디에 적을까"의 기준은 수명이다. 영원한 원칙 → AGENTS.md,
지금의 상태 → PROGRESS.md, 언젠가 할 것 → IDEAS.md. 수명이 다른 정보를 한 파일에 섞으면 썩는다.

## 3. 이 프로젝트에서 볼 수 있는 하네스 패턴 실례

1. **원칙의 다층 강제** — "AI는 경험을 창조하지 않는다"를 프롬프트(권고) → 코드 검증(차단) → DB CHECK(최후 방어)로 겹겹이 강제. 프롬프트만 믿지 않는 것이 하네스 설계의 기본기
2. **프로바이더 추상화** — `src/lib/llm.ts` 하나로 Claude↔Ollama 전환. 하네스는 특정 모델에 결혼하지 않는다
3. **피드백 루프의 제도화** — IDEAS.md에 쌓고, 세션 시작 규칙으로 회수. 사람의 관찰이 에이전트의 다음 작업으로 흐르는 배관
4. **구조화 출력** — LLM 출력을 자유 텍스트가 아니라 zod 스키마로 받는다. 파싱 실패라는 에러 클래스 자체를 제거

## 4. 직접 해보는 연습 (난이도순)

1. **스킬 하나 만들기** — `.claude/skills/db-peek/SKILL.md`: "DB 내용 보여줘"라고 하면 sqlite3로 주요 테이블 요약을 뽑는 스킬. description을 어떻게 써야 자동 발동하는지 실험
2. **권한 조이기/풀기** — settings.json에서 `Bash(npm run build)`를 allow에서 빼보고 확인 프롬프트가 뜨는 것을 관찰
3. **훅(hook) 붙이기** — `PostToolUse` 훅으로 Edit 후 자동 `npm run lint` 실행. settings.json의 `hooks` 키에 선언 (훅은 "매번 반드시" 실행되어야 하는 것에 쓴다 — 규칙은 잊혀도 훅은 안 잊는다)
4. **컨텍스트 다이어트** — AGENTS.md에서 한 섹션을 별도 파일로 빼고 참조로 바꿔보기. 응답 품질이 유지되는지 관찰
5. **평가 루프 만들기** — pipeline-eval 스킬을 발전시켜, 분석 결과 품질을 점수화하고 프롬프트 수정 전후를 비교하는 미니 eval 구축

## 5. 더 읽을 것

- Claude Code 공식 문서: https://code.claude.com/docs (memory, skills, hooks, settings 챕터)
- Anthropic — Effective context engineering for AI agents (블로그)
- Anthropic — Claude Code Best Practices (블로그)
- 이 프로젝트의 gstack 설계 문서: `~/.gstack/projects/Dev/` (office-hours가 만든 원본)
