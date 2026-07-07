---
name: pipeline-eval
description: 분석 파이프라인의 품질을 점검할 때 사용. "품질 확인해줘", "분석 결과 평가해줘", 프롬프트/모델 변경 후 회귀 확인, 새 공고 분석이 이상해 보일 때.
---

# 파이프라인 품질 점검

최근 분석 결과가 프로젝트의 절대 원칙(AI 저작권 경계)과 품질 기준을 지키는지 DB에서 직접 검증한다.

## 절차

1. **대상 선정**: 최근 분석 완료된 공고 (인자로 ID를 받으면 그것을 사용):
   ```bash
   sqlite3 data/app.db "SELECT id, title, fit_json, verdict FROM job_postings WHERE analysis_status='done' ORDER BY id DESC LIMIT 3;"
   ```

2. **불변식 검사** (하나라도 위반이면 버그 — 즉시 보고):
   ```bash
   # a. 출처 없는 AI 문장 = 0 이어야 함
   sqlite3 data/app.db "SELECT count(*) FROM draft_sentences WHERE type='ai' AND primary_source_card_id IS NULL;"
   sqlite3 data/app.db "SELECT count(*) FROM interview_answer_points WHERE type='ai' AND primary_source_card_id IS NULL;"
   # b. 매칭 없는 요구사항에는 되묻기가 있어야 함
   sqlite3 data/app.db "SELECT r.id, r.text FROM requirements r LEFT JOIN matches m ON m.requirement_id=r.id LEFT JOIN askbacks a ON a.requirement_id=r.id WHERE m.id IS NULL AND a.id IS NULL;"
   ```

3. **품질 휴리스틱 검사** (위반이면 프롬프트 개선 후보):
   - **적합도 인플레이션**: 카드의 `not_claimable`에 해당하는 카테고리 점수가 80 이상인가? (예: "결제 도메인 전문성 없음"인데 domain 100점)
   - **초안 문장 수**: intro 초안의 ai 문장이 2개 미만이거나 10개 초과인가?
   - **면접 질문 수**: posting 질문 5개 미만 또는 weakness 질문 0개인가?
   - **경고 비율**: over_claim 문장이 전체의 30%를 넘으면 생성 프롬프트가 과장을 유도하는 것
   - 초안 문장을 실제로 읽고 카드 내용과 대조해 어색한 과장/번역투가 있는지 확인

4. **기록**: 발견 사항을 `IDEAS.md`의 "로컬 모델 품질 관찰" 섹션에 날짜와 함께 추가. 불변식 위반은 즉시 수정 대상, 휴리스틱 위반은 open 항목으로.

5. **보고**: 불변식 통과 여부 + 휴리스틱 발견 사항 + 권장 다음 조치를 요약.

## 프롬프트 수정 후 회귀 확인 시

같은 공고를 재분석(`POST /api/postings/{id}/analyze`)하고 수정 전후의 fit 점수, 문장 수, 경고 수를 표로 비교한다. 로컬 모델은 1회 약 6분 걸리므로 시작 전에 사용자에게 알린다.
