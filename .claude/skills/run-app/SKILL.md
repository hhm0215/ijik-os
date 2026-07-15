---
name: run-app
description: 이직 OS 앱을 실행하고 정상 동작을 확인할 때 사용. "앱 켜줘", "돌려봐", "실행해서 확인해줘", 기능 구현 후 실제 동작 검증이 필요할 때.
---

# 앱 실행 + 스모크 테스트

## 절차

1. **Ollama 상태 확인** (LLM 기본 경로가 로컬이므로 먼저):
   ```bash
   curl -s --max-time 3 http://localhost:11434/api/version && ollama list
   ```
   - 응답 없으면: `brew services start ollama` 후 재확인
   - `qwen3:8b`(또는 `OLLAMA_MODEL`에 설정된 모델)가 목록에 없으면 사용자에게 `ollama pull` 필요 여부 확인

2. **기존 포트의 앱 정체 확인**:
   ```bash
   curl -i -s http://127.0.0.1:3000/api/cards
   ```
   - `200` + `application/json` 배열이면 기존 ijik-os 서버를 재사용한다.
   - HTML이나 다른 앱 응답이면 사용자 프로세스를 임의 종료하지 말고, 아래 실행 명령에 `-- -p <빈 포트>`를 붙인다.

3. **dev 서버 실행** (백그라운드, 기존 ijik-os가 없을 때):
   ```bash
   npm run dev
   ```
   기본 포트 3000. 포트 충돌 시 Next가 출력한 실제 URL과 프로세스 디렉터리를 확인한다.
   단순히 다음 포트가 출력됐다는 이유만으로 그 포트의 기존 앱을 ijik-os로 간주하지 않는다.

4. **스모크 체크** (`APP_URL`은 확인된 실제 ijik-os 주소):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" "$APP_URL/"        # 200
   curl -i -s "$APP_URL/api/cards"                            # 200 + JSON 배열
   ```

5. **보고**: 접속 URL, Ollama 모델명, 카드/공고 개수(`sqlite3 data/app.db "SELECT count(*) FROM experience_cards WHERE archived=0; SELECT count(*) FROM job_postings;"`)를 한 줄로 알려준다. 포트 충돌이 있었다면 다른 앱의 포트와 검증에 사용한 포트를 함께 남긴다.

## 주의

- 분석 파이프라인 테스트까지 요청받았을 때만 공고 분석을 실행한다 (로컬 모델로 1회 약 6분 소요 — 사용자에게 먼저 알릴 것)
- 검증 후 서버를 계속 쓸지 물어보지 말고, 사용자가 직접 쓸 상황이면 켜둔 채로 보고한다
