---
id: 2026-10-14-site-drift-daily-ci-check
type: task
title: 사이트 드리프트 24시간 점검 CI 추가 — PAL·NSM·LIKMS의 DOM·AJAX 계약을 실사이트와 대조
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [ci, drift, pal, nsm, likms, operations]
supersedes: null
superseded_by: null
---

## 문제

이 라이브러리의 회귀는 **조용히** 일어난다. 파서는 프로젝트 규약상 예외를 던지지 않고
빈 배열·`null`·0을 돌려주므로(AGENTS.md "파서는 절대 예외를 던지지 않는다"), 대상 사이트가
리뉴얼되면 테스트는 통과하고 사용자만 데이터 결손을 본다. 기존 방어선은 두 개인데 모두 부족했다:

- `src/*.test.ts` fixture — 실제 캡처를 **사람이** 갱신해야 최신이 된다(자동 감지 없음).
- `scripts/verify-dist.js --live` — 실사이트를 호출하지만 사람이 손으로 돌려야 한다.

그래서 "사이트가 코드의 기대와 같은가"를 주기적으로 자동 확인하고, 어긋나면 알리는
경로를 만들었다.

## 사실 (2026-10-14 실측)

- **점검기**: `scripts/check-site-drift.js` — `dist/index.js`(배포 산출물)를 임포트해
  공개 API(`getPalHTML`·`search`·`getStateListHTML`·`getBillInfoHTML` 등)로 실사이트를
  호출한 뒤 **파서가 쓰는 선택자·엔드포인트·응답 필드**를 확인한다. 점검 항목 18개:
  PAL 5 · NSM 5 · likms 7 · 교차 1(PAL contentId → likms 제안이유 보정).
- **판정 3종과 종료 코드**: `ok` / `drift`(사이트 변경: 선택자·필드 소실·개명, 재시도 후
  4xx·5xx) / `error`(확인 불가: 타임아웃·DNS). 종료 코드 `0`=전부 ok, `1`=drift 있음,
  `2`=확인 불가만. **일시 장애로 이슈가 소진되지 않도록** drift와 확인 불가를 나눈 것이
  핵심 설계다(확인 불가는 이슈를 새로 만들지 않고 열린 이슈에만 코멘트).
- **선행 의존**: 점검이 서로 물려 있다(`dependsOn`). 선행이 실패하면 뒤 항목은 `skipped`로
  표시해 "통과"로 세지 않는다(예: 목록 선택자가 사라지면 상세 점검은 의미가 없다).
- **검출기 자체 검증**: `npm run drift:self-test` — 네트워크 없이 분류·집계·종료 코드·
  리포트 렌더링을 확인한다(클래스명 변경 fixture → drift, 타임아웃 → error 등 5케이스).
  `.github/workflows/test.yml`에 붙여 PR마다 돈다.
- **네거티브 실측**: `dist/config.js`의 `LIST_URL`을 존재하지 않는 경로로 바꾸자
  `pal/list-dom`이 drift로 잡히고 나머지 PAL 항목이 skipped, 종료 코드 1로 실패했다.
- **정상 실측(1회)**: 18/18 ok, 약 40초. 주요 수치 — PAL total 246(페이지당 10),
  NSM total 21,336 / 17,112쪽, likms 계류 15,950 / 319쪽(50건)·법사위 1,618·계류 15,547,
  `findCommittees(22,22)` 25건(법제사법위원회=9700006), PAL 첫 contentId → likms 제안이유 453자.
- **자동화**: `.github/workflows/site-drift.yml` — `cron: '0 21 * * *'`(06:00 KST) +
  `workflow_dispatch`(사이트 선택 입력). 요청은 300ms 간격 순차, 재시도 2회, 20초 타임아웃,
  `concurrency: site-drift`로 중복 실행 차단.
- **알림**: `scripts/notify-site-drift.sh <report.json> <drift|inconclusive|resolved>` —
  제목 고정(`[site-drift] 대상 사이트 구조 변경 감지`) 이슈가 열려 있으면 코멘트, 없으면
  생성(drift) / 해소 시 복구 코멘트 후 닫기(resolved). `DRIFT_WEBHOOK_URL` 시크릿이 있으면
  Slack/Discord/Teams 웹훅으로도 보낸다. 리포트는 Step Summary + 아티팩트
  `site-drift-report`(30일 보존)로 남는다.
- **초기 오탐 4건을 실측으로 걷어냈다** — "빈 값이 정상인 자리"를 몰라서 낸 오탐이며,
  사실 자체는 [2026-10-14-drift-contract-empty-value-cases](../site-notes/2026-10-14-drift-contract-empty-value-cases.md)에 정리했다.

## 결론/행동

- **운영**: 매일 06:00 KST에 자동 실행된다. 수동 점검은 Actions → `Site drift check` →
  Run workflow(`sites`에 `pal,nsm,likms,bridge` 중 일부만 넣을 수 있다). 로컬은
  `npm run build && npm run drift:check`(결과 JSON/Markdown은 `--json`/`--markdown`).
- **제약**: `schedule`은 **기본 브랜치(main)의 워크플로 파일만** 실행하므로 이 파일이 main에
  병합돼야 돈다. 저장소에 60일간 활동이 없으면 GitHub가 예약 실행을 자동 비활성화한다
  (Actions 탭에서 다시 켠다).
- **drift가 뜨면**: (1) 사이트를 직접 열어 선택자·엔드포인트·응답 필드를 확인하고,
  (2) 변화가 확정되면 `agent_memories/site-notes/`에 기록한 뒤, (3) 파서·크롤러를 고치고
  `src/*.test.ts` fixture를 실제 캡처로 갱신한다(파서 변경은 fixture 테스트를 먼저
  깨뜨려 회귀를 잡는 규약).
- **점검 항목을 늘릴 때**: 새 점검은 (a) 코드가 실제로 의존하는 것만, (b) 값이 아니라
  **계약**(선택자 존재·필드 형식·필터가 결과를 좁히는지)을 보게 한다. 실시간 값(건수·의안명·
  발의자명)을 고정값으로 박으면 라이브 테스트 규약과 같은 이유로 조용히 썩는다.
- **점검은 배포 산출물(`dist`)을 기준으로 한다** — 사용자가 받는 코드가 기준이어야 하고,
  빌드가 깨지면 점검 전에 워크플로가 멈춘다.
