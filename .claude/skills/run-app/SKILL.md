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

2. **dev 서버 실행** (백그라운드):
   ```bash
   npm run dev
   ```
   기본 포트 3000. 이미 떠 있으면 재사용.

3. **스모크 체크**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/        # 200
   curl -s http://localhost:3000/api/cards | head -c 100                # JSON 배열
   ```

4. **보고**: 접속 URL, Ollama 모델명, 카드/공고 개수(`sqlite3 data/app.db "SELECT count(*) FROM experience_cards WHERE archived=0; SELECT count(*) FROM job_postings;"`)를 한 줄로 알려준다.

## 주의

- 분석 파이프라인 테스트까지 요청받았을 때만 공고 분석을 실행한다 (로컬 모델로 1회 약 6분 소요 — 사용자에게 먼저 알릴 것)
- 검증 후 서버를 계속 쓸지 물어보지 말고, 사용자가 직접 쓸 상황이면 켜둔 채로 보고한다
