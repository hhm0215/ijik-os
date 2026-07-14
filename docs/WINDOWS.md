# Windows에서 이어서 개발하기

이 저장소의 코드·계획·세션 기록은 Git으로 공유하지만, 실제 경험 데이터가 들어가는
`data/app.db`는 개인정보이므로 Git에 올리지 않는다. Windows에서도 같은 저장소를
내려받아 로컬 개발하고, 데이터베이스는 해당 PC의 로컬 파일을 사용한다.

## 1. 필요한 환경

- Git
- Node.js 22 LTS
- Ollama 최신 버전 권장 (`0.31` 이상에서 검증)

Windows Ollama `0.13.1`은 큰 JSON 스키마의 구조화 출력에서 실패한 기록이 있다.
버전이 낮으면 Ollama를 먼저 업데이트한다.

```powershell
ollama --version
ollama pull qwen3:8b
ollama list
```

Ollama Windows 앱이 실행 중이면 별도로 `ollama serve`를 띄우지 않는다.

## 2. 최신 작업 이어받기

```powershell
cd ~/Documents/Dev/ijik-os
git pull
npm ci
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다. 다른 앱이 3000을 사용하면 Next.js가
안내하는 실제 포트를 사용한다.

세션 시작 시 아래 문서를 읽는다.

1. `AGENTS.md` — 개발·저장소 경계 규칙
2. `docs/PROGRESS.md` — 마지막 세션과 다음 진입점
3. `IDEAS.md` — 열린 품질·기능 항목

## 3. 현재 첫 사용 흐름

1. 경험 뱅크 → `문서에서 가져오기`
2. 이력서·자소서·포트폴리오 PDF/DOCX/TXT/MD 업로드
3. AI가 만든 경험 후보를 원문과 비교해 수정·선택
4. 선택한 카드만 저장
5. 홈에서 채용 공고를 붙여넣어 분석

문서 파일 자체는 저장하지 않는다. 후보 생성 후 사용자가 저장한 경험 카드만
`data/app.db`에 들어간다.

## 4. 데이터 이동 주의

- Windows와 Mac의 SQLite는 자동 동기화하지 않는다.
- 실제 사용을 시작하면 한 환경의 DB를 원본으로 정한다.
- DB를 옮겨야 하면 앱을 양쪽 모두 종료한 뒤 `data/app.db`를 복사한다.
- 실행 중인 DB의 `app.db-wal`, `app.db-shm`만 따로 복사하지 않는다.

## 5. 작업 완료 게이트

```powershell
npm run lint
npm run build
git status --short
```

의미 있는 작업 단위가 끝나면 `IDEAS.md`와 `docs/PROGRESS.md`를 갱신하고 커밋·푸시한다.
