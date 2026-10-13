---
id: 2026-10-14-inconclusive-retry
type: decision
title: 확인 불가(타임아웃)는 지연 후 1회 재점검하고 판정 우선순위로 병합한다
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [ci, drift, reliability, convention]
supersedes: null
superseded_by: null
---

## 문제

2026-10-14 계약 검증 실행에서 **세 사이트가 동시에 20초 타임아웃**되어 판정이
`확인 불가` 5건 · 종료 코드 2로 끝났고, 정기 워크플로는 설계상 이를 실패로 처리하므로
**빨간 실행 + GitHub 실패 알림**이 남았다. 4분 전 같은 실행은 18/18 계약 유지였고 직후
재실행도 계약 유지였다 — 코드·계약과 무관한 순간적 네트워크 문제였다. 사람이 "다시 돌리면
되는 실패"를 매번 판단해야 하는 상태였고, 그런 실행이 반복되면 알림이 소진된다.

## 사실 (2026-10-14 실측)

- 타임아웃은 `HttpClient`가 재시도 2회까지 마친 뒤의 결과다(점검기는 `retryCount: 2`,
  `timeout: 20000`). 그래서 요청 계층의 재시도만으로는 부족했다 — 필요한 것은 **잠시 기다린 뒤
  다시 시도**하는 것이다.
- 점검은 앞 점검이 만든 컨텍스트(받은 HTML·파싱 결과)에 의존하므로(예: `pal/list-parse`의
  `from: 'palHtml'`) **개별 점검만 따로 다시 돌릴 수 없다**. 그래서 재점검은 확인 불가가 난
  **사이트 단위**로 다시 돈다.
- 부분 재점검 도구 실측(강제 타임아웃 `timeout: 1`, `--retry 1 --retry-delay 0`):
  1차에서 `pal/list-dom`이 확인 불가 → 그 사이트를 재점검 → 리포트의 `retry`에
  `{attempts: 1, delayMs: 0, sites: ['pal'], checks: 5, recovered: []}`, 종료 코드는 2 유지.
  즉 재점검은 판정을 왜곡하지 않고 기록만 남긴다.
- `HttpClient.requestWithRetry`(`src/http-client.ts:225-243`)는 `retryCount: 0`이면 루프가
  한 번도 돌지 않아 `lastError`가 `undefined`인 채 `throw lastError!`로 **`undefined`를 던진다**.
  위 실험의 1차 오류 메시지가 `undefined`로 나온 이유가 이것이다(점검기 기본값은 `retryCount: 2`라
  실제 실행에서는 나타나지 않는다). 사용자 설정으로 도달 가능한 별개 결함이다.

## 결론/행동

- `scripts/check-site-drift.js`에 **재점검**을 넣었다: 계약 위반이 없는데 확인 불가가 남으면
  기본 **15초 대기 후 1회**(`--retry <n>`, `--retry-delay <ms>`; `--retry 0`이면 끔) 확인 불가가
  난 사이트를 다시 점검한다.
- 병합 규칙은 **판정 우선순위**(`STATUS_RANK`: `drift` 3 > `ok` 2 > `error` 1 > `skipped` 0)다.
  재점검 결과가 더 강할 때만 채택하므로 **일시 장애는 회복되지만 드리프트는 재점검 성공으로
  가려지지 않는다** — 계약 위반을 놓치는 쪽이 더 큰 손실이고, 드리프트는 실패로 남아야 한다.
  같은 순위면 1차 판정을 유지한다(1차에서 통과한 항목은 저하되지 않는다).
- 이미 드리프트가 있으면(종료 코드 1) 재점검하지 않는다 — 실패가 확정인데 사이트 부하만 늘리기 때문.
- 기록은 리포트의 `retry`(`attempts`, `delayMs`, `sites`, `checks`, `recovered`)와 점검별
  `retried`/`previousStatus`에 남는다. Markdown·콘솔·이슈 본문·웹훅이 이를 보여주므로,
  알림을 보는 사람은 "재점검까지 했는데 남은 확인 불가"인지 알 수 있다.
- 오프라인 `--self-test`가 회복·잔여 확인 불가·**드리프트 보존**·리포트 렌더링을 검증한다
  (네트워크 없이 재점검 로직을 고정). 실제 네트워크 실패 경로는 강제 타임아웃 실행으로 확인했다.
- 남은 판단(자동 재시도 횟수를 늘릴지, `retryCount: 0` 결함을 고칠지)은 이 레코드에 근거를 남긴다.
