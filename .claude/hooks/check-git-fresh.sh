#!/usr/bin/env bash
# SessionStart 훅: 세션 시작 시 로컬이 origin/main 대비 뒤처졌는지 확인.
# Mac/Windows(Git Bash) 두 작업 머신을 오가므로, 구버전 코드 위에서 작업을
# 시작하는 사고를 막는다. 오프라인이면 조용히 통과.
git fetch --quiet origin main 2>/dev/null || exit 0
behind=$(git rev-list --count HEAD..origin/main 2>/dev/null) || exit 0
ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null) || exit 0
if [ "${behind:-0}" -gt 0 ]; then
  msg="로컬이 origin/main보다 ${behind}커밋 뒤처짐"
  [ "${ahead:-0}" -gt 0 ] && msg="$msg (로컬 전용 커밋 ${ahead}개 있음 — 갈라짐)"
  printf '{"systemMessage":"⚠ %s — git pull 권장","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s. 작업 시작 전 git pull(갈라졌으면 rebase)을 먼저 제안할 것."}}\n' "$msg" "$msg"
fi
exit 0
