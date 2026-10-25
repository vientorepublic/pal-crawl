#!/usr/bin/env bash
#
# scripts/notify-site-drift.sh — 크롤러 계약 검증 결과를 사람에게 알린다.
#
# 24시간 주기 점검(`.github/workflows/site-drift.yml`)이 남긴 JSON 리포트를 읽어
# GitHub 이슈로 알린다(같은 주제의 열린 이슈가 있으면 코멘트로 잇는다).
# 확인 불가(타임아웃 등)는 검증기가 판정 전에 지연 후 1회 재점검하며, 그 기록은
# 리포트의 `retry`에 있다 — 본문·웹훅은 재점검 후에도 남은 확인 불가만 보고한다.
# 선택적으로 `DRIFT_WEBHOOK_URL`(Slack/Discord/Teams/Google Chat 등)로도 보낸다.
#
# 사용:
#   scripts/notify-site-drift.sh <report.json> [drift|inconclusive|resolved]
#
# 모드(값 자체는 스크립트 인터페이스라 그대로 두고, 의미만 계약 관점으로 적는다):
#   drift        계약 위반 감지 → 이슈 생성 또는 코멘트(제목을 고정해 중복을 막는다)
#   inconclusive 확인 불가(타임아웃 등) → 열린 이슈에만 코멘트, 새 이슈는 만들지 않는다
#   resolved     계약 복구 → 열린 이슈에 복구 코멘트 후 닫는다
#
# 환경변수:
#   GH_TOKEN            gh CLI 인증 토큰(워크플로에서는 secrets.GITHUB_TOKEN)
#   GITHUB_REPOSITORY   소유자/저장소 (gh -R에 사용, 없으면 현재 디렉터리 기준)
#   DRIFT_WEBHOOK_URL   선택: 알림 웹훅 URL (없으면 웹훅 단계를 건너뜀)
#   DRIFT_LABEL         이슈 라벨 (기본 crawler-contract)
#   DRIFT_DRY_RUN=1     실제 gh/curl 호출 없이 보낼 내용만 출력(로컬 검증용)
#
# 알림 실패가 점검 결과를 가리지 않도록, 이 스크립트는 워크플로에서
# `continue-on-error`로 실행하고 판정(계약 위반이면 job 실패)은 별도 단계가 맡는다.

set -euo pipefail

REPORT_PATH="${1:?사용: notify-site-drift.sh <report.json> [drift|inconclusive|resolved]}"
MODE="${2:-drift}"
LABEL="${DRIFT_LABEL:-crawler-contract}"
ISSUE_TITLE="${DRIFT_ISSUE_TITLE:-[계약 위반] 실사이트 응답이 크롤러 계약과 다름}"
DRY_RUN="${DRIFT_DRY_RUN:-0}"

if [[ ! -f "${REPORT_PATH}" ]]; then
  echo "리포트 파일이 없습니다: ${REPORT_PATH}" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq가 필요합니다 (러너에는 기본 설치되어 있음)." >&2
  exit 1
fi

case "${MODE}" in
  drift | inconclusive | resolved) ;;
  *)
    echo "알 수 없는 모드입니다: ${MODE} (drift|inconclusive|resolved)" >&2
    exit 1
    ;;
esac

readonly REPORT_PATH MODE LABEL ISSUE_TITLE DRY_RUN

gh_repo_args=()
if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
  gh_repo_args+=(-R "${GITHUB_REPOSITORY}")
fi

# ─── 리포트에서 알림 본문 만들기 ─────────────────────────────────────────────

# 이슈 본문은 jq로 만든다 — 셸 문자열 보간으로 조립하면 사이트에서 온 값의
# 특수문자가 본문을 깨뜨릴 수 있다.
build_issue_body() {
  # 주의: jq에서 배열 리터럴 안의 `"a", [...] + [...]`는 "+"가 아니라 요소 나열로
  # 해석되지 않고 합산으로 묶인다(","가 "+"보다 강하게 묶임). 그래서 요소를
  # 쉼표와 `empty`로 흘려보내는 형태로만 조립한다.
  jq -r --arg mode "${MODE}" '
    ($mode) as $m
    | (.retry.attempts // 0) as $retried
    | [
        (if $m == "drift"
           then "## ❌ 크롤러 계약 위반 — 실사이트 응답이 파서의 기대와 다릅니다"
         elif $m == "inconclusive"
           then "## ⚠️ 확인 불가 — 대상 사이트에 접속하지 못했습니다"
         else "## ✅ 복구됨 — 계약이 다시 유지됩니다"
         end),
        "",
        "24시간 주기 점검이 PAL·NSM·LIKMS의 DOM·AJAX 계약을 실사이트와 대조한 결과입니다.",
        "",
        "- 점검 시각: `\(.checkedAtKst // .checkedAt)`",
        "- 패키지 버전: `\(.libraryVersion)`",
        "- 점검 결과: 점검 \(.summary.checks)건 · 계약 유지 \(.summary.ok) · 계약 위반 \(.summary.drift) · 확인 불가 \(.summary.inconclusive) · 건너뜀 \(.summary.skipped)",
        (if $retried > 0
           then "- 재점검: 확인 불가 항목을 지연 \(.retry.delayMs)ms 두고 \(.retry.attempts)회 다시 점검 — 판정 변경 \(.retry.recovered | length)건"
           else empty end),
        (if .runUrl then "- 실행 로그: \(.runUrl)" else empty end),
        (if .summary.skipped > 0
           then "- ⚠️ 선행 점검 실패로 건너뛴 항목 \(.summary.skipped)건 — 점검 범위가 줄었습니다(리포트 참조)."
           else empty end),
        "",
        (if (.drift | length) > 0
           then "### 계약 위반 항목 — 사이트 응답에서 사라진 선택자·엔드포인트·필드", ""
           else empty end),
        (.drift[]? | "- **`\(.id)`** — \(.label): \(.detail)"),
        (if (.drift | length) > 0 then "" else empty end),
        (if (.inconclusive | length) > 0
           then (if $retried > 0
                   then "### 확인 불가 — 지연 재점검 후에도 확인되지 않음(사이트 변경인지 일시 장애인지 미확정)"
                   else "### 확인 불가(사이트 변경인지 일시 장애인지 미확정)"
                 end), ""
           else empty end),
        (.inconclusive[]? | "- **`\(.id)`** — \(.label): \(.detail)"),
        (if (.inconclusive | length) > 0 then "" else empty end),
        (if $m == "resolved"
           then "계약이 복구되어 이 이슈를 닫습니다. 원인과 패치 PR 링크를 코멘트로 남겨 주세요."
           else "### 다음 조치" end),
        (if $m == "resolved"
           then empty
           else
             "1. 위 항목의 대상 사이트를 브라우저로 열어 선택자·엔드포인트·응답 필드를 확인한다.\n2. 변화가 확정되면 `agent_memories/site-notes/`에 기록한다(형식: `agent_memories/README.md`).\n3. 파서·크롤러를 수정하고 `src/*.test.ts` fixture를 실제 캡처로 갱신한다 — 파서 변경은 fixture 테스트를 먼저 깨뜨려 회귀를 잡는 것이 규약이다.\n4. `npm run typecheck && npm run lint && npm test && npm run build` 게이트를 통과시킨 뒤 PR로 `main`에 병합한다.\n5. 패치 후 이 워크플로를 수동 실행(Actions → Contract check (daily) → Run workflow)해 계약 복구를 확인한다.\n\n리포트 전체(점검 항목별 결과·선택자 인벤토리)는 해당 실행의 아티팩트 `contract-check-report`에 있다."
           end),
        ""
      ]
    | join("\n")
  ' "${REPORT_PATH}"
}

# 웹훅은 한눈에 보이는 짧은 텍스트로 보낸다
# (Slack/Teams/Google Chat은 `text`, Discord는 `content`를 읽는다 — 둘 다 넣어 보낸다).
build_webhook_text() {
  jq -r --arg mode "${MODE}" '
    ($mode) as $m
    | [
        (if $m == "drift" then "❌ 크롤러 계약 위반 감지"
         elif $m == "inconclusive" then "⚠️ 계약 확인 불가(접속 실패)"
         else "✅ 크롤러 계약 검증 성공"
         end),
        "계약 위반 \(.summary.drift)건 · 확인 불가 \(.summary.inconclusive)건 (점검 \(.summary.checks)건, \(.checkedAtKst))",
        (if (.retry.attempts // 0) > 0
           then "재점검 \(.retry.attempts)회(대기 \(.retry.delayMs)ms) — 판정 변경 \(.retry.recovered | length)건"
           else empty end),
        (.drift[]? | "• \(.id): \(.detail)"),
        (.inconclusive[]? | "• \(.id): \(.detail)"),
        (if .runUrl then "로그: \(.runUrl)" else empty end)
      ]
    | join("\n")
  ' "${REPORT_PATH}"
}

# 같은 제목의 열린 이슈 번호(없으면 빈 문자열)
find_open_issue() {
  gh issue list "${gh_repo_args[@]}" --label "${LABEL}" --state open --limit 50 \
    --json number,title \
    | jq -r --arg title "${ISSUE_TITLE}" \
      '[.[] | select(.title == $title) | .number] | first // empty'
}

ensure_label() {
  gh label create "${LABEL}" "${gh_repo_args[@]}" \
    --color B60205 \
    --description "크롤러 계약 위반 감지(자동 점검)" \
    --force >/dev/null 2>&1 \
    || echo "라벨 확인 실패(이미 있으면 무시): ${LABEL}" >&2
}

comment_on_issue() {
  local issue_number="$1"
  local body_file="$2"
  gh issue comment "${issue_number}" "${gh_repo_args[@]}" \
    --body-file "${body_file}" >/dev/null
  echo "이슈 #${issue_number}에 코멘트했습니다."
}

send_webhook() {
  if [[ -z "${DRIFT_WEBHOOK_URL:-}" ]]; then
    echo "DRIFT_WEBHOOK_URL이 없어 웹훅을 건너뜁니다."
    return 0
  fi

  local payload
  payload="$(jq -n --arg text "$(build_webhook_text)" \
    '{text: $text, content: $text}')"

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] 웹훅 payload:"
    printf '%s\n' "${payload}" | head -c 600
    echo
    return 0
  fi

  local status
  status="$(printf '%s' "${payload}" | curl -sS -o /dev/null -w '%{http_code}' \
    --max-time 20 -X POST -H 'Content-Type: application/json' -d @- \
    "${DRIFT_WEBHOOK_URL}" || echo '000')"

  if [[ "${status}" =~ ^2 ]]; then
    echo "웹훅 전송 완료 (HTTP ${status})."
  else
    echo "웹훅 전송 실패 (HTTP ${status}) — 이슈 알림은 그대로 유지됩니다." >&2
  fi
}

# ─── 실행 ────────────────────────────────────────────────────────────────────

DRIFT_COUNT="$(jq -r '.summary.drift' "${REPORT_PATH}")"
INCONCLUSIVE_COUNT="$(jq -r '.summary.inconclusive' "${REPORT_PATH}")"

BODY_FILE="$(mktemp)"
trap 'rm -f "${BODY_FILE}"' EXIT
build_issue_body >"${BODY_FILE}"

echo "알림 모드: ${MODE} (계약 위반 ${DRIFT_COUNT} · 확인 불가 ${INCONCLUSIVE_COUNT})"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "── 이슈 제목 ──"
  echo "${ISSUE_TITLE}"
  echo "── 이슈 본문 ──"
  cat "${BODY_FILE}"
  echo "── (dry-run: gh/curl 호출 없음) ──"
  send_webhook
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI가 없어 이슈 알림을 건너뜁니다." >&2
  send_webhook
  exit 0
fi

case "${MODE}" in
  drift)
    ensure_label
    ISSUE_NUMBER="$(find_open_issue)"
    if [[ -n "${ISSUE_NUMBER}" ]]; then
      comment_on_issue "${ISSUE_NUMBER}" "${BODY_FILE}"
    else
      NEW_URL="$(gh issue create "${gh_repo_args[@]}" \
        --title "${ISSUE_TITLE}" \
        --label "${LABEL}" \
        --body-file "${BODY_FILE}")"
      echo "이슈를 새로 만들었습니다: ${NEW_URL}"
    fi
    ;;
  inconclusive)
    ISSUE_NUMBER="$(find_open_issue)"
    if [[ -n "${ISSUE_NUMBER}" ]]; then
      comment_on_issue "${ISSUE_NUMBER}" "${BODY_FILE}"
    else
      echo "열린 계약 위반 이슈가 없어 새 이슈를 만들지 않습니다(일시 장애 가능성)."
    fi
    ;;
  resolved)
    ISSUE_NUMBER="$(find_open_issue)"
    if [[ -n "${ISSUE_NUMBER}" ]]; then
      comment_on_issue "${ISSUE_NUMBER}" "${BODY_FILE}"
      gh issue close "${ISSUE_NUMBER}" "${gh_repo_args[@]}" >/dev/null
      echo "이슈 #${ISSUE_NUMBER}를 닫았습니다."
    else
      echo "닫을 계약 위반 이슈가 없습니다."
    fi
    ;;
esac

send_webhook
