---
id: 2026-10-14-contract-verification-wording
type: decision
title: 사람에게 보이는 이름을 "사이트 드리프트"에서 "크롤러 계약 검증"으로 바꾼다
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [ci, drift, convention, naming]
supersedes: null
superseded_by: null
---

## 문제

"사이트 드리프트"는 이 저장소 안에서만 통하는 말이다. 워크플로 이름(`Site drift check`),
콘솔 배너(`pal-crawl 사이트 드리프트 점검`), 이슈 제목·라벨(`[site-drift] …`), 웹훅 제목이
모두 이 단어를 쓰고 있어서, 알림을 처음 보는 사람은 **무엇을 왜 확인하는지** 알 수 없다.
정작 이 장치가 하는 일은 "실사이트 응답이 파서가 기대하는 계약(선택자·엔드포인트·응답
필드)과 그대로인지 검증하고, 깨져 있으면 병합·릴리스를 막는 것"이다.

## 사실 (2026-10-14)

- 사람이 보는 문자열은 `scripts/check-site-drift.js`(배너·요약·Markdown 리포트),
  `scripts/notify-site-drift.sh`(이슈 제목·본문·웹훅), 워크플로 이름·스텝명과 아티팩트명에
  흩어져 있었다(사용자 노출 "드리프트" 30여 곳).
- 자체 테스트(`--self-test`)는 **상태 값**(`ok`/`drift`/`error`)과 렌더 결과에 점검 id가
  들어 있는지만 단언한다 — 표시 문구를 바꿔도 깨지지 않는다(실측: 11/11 통과).
- 기존 `site-drift` 라벨과 드리프트 이슈는 아직 없었다(라벨 목록·이슈 목록 확인) →
  이슈 제목·라벨을 바꿔도 중복 이슈가 생기지 않는다. 알림 스크립트는 고정 제목으로
  기존 이슈를 찾으므로 제목을 바꾸면 과거 이슈와는 다른 이슈가 된다.

## 결론/행동

사람에게 보이는 이름만 계약 관점으로 통일했다(규칙은 AGENTS.md "PR/병합 규칙" 3번).

| 이전 | 이후 |
|------|------|
| `Site drift check` (워크플로) | `Contract check (daily)` |
| `Contract check (live sites)` | `Contract check (pull requests)` |
| 배너 `pal-crawl 사이트 드리프트 점검` | `pal-crawl 크롤러 계약 검증 — 실사이트 응답을 파서의 계약과 대조` |
| 리포트 제목 `사이트 드리프트 점검 결과` | `크롤러 계약 검증 결과` |
| 상태 라벨 없음(`drift`) | `계약 위반` (`STATUS_LABEL`), `ok` → `계약 유지` |
| 결과 줄 `드리프트 감지 ❌` | `계약 위반 ❌ (실사이트 응답이 계약과 다름 — 파서·계약 확인 필요)` |
| 이슈 제목 `[site-drift] 대상 사이트 구조 변경 감지` | `[계약 위반] 실사이트 응답이 크롤러 계약과 다름` |
| 라벨 `site-drift` | `crawler-contract` |
| 웹훅 `❌ pal-crawl 사이트 드리프트 감지` | `❌ pal-crawl 크롤러 계약 위반 감지` |
| 아티팩트 `site-drift-report` / `pr-drift-report` | `contract-check-report` / `pr-contract-check-report` |

의도적으로 **바꾸지 않은 것**(내부 식별자·기계 계약):

- 파일명 `scripts/check-site-drift.js`, `scripts/notify-site-drift.sh`, `scripts/drift-contracts/`
  — 워크플로·문서·메모리가 경로로 참조한다.
- npm 스크립트 `drift:check` / `drift:self-test` / `drift:contracts` — CI와 문서가 그대로
  실행하며, 바꾸면 이전 메모리 기록이 전부 낡은 명령을 가리키게 된다(append-only).
- 환경변수 `DRIFT_WEBHOOK_URL`(저장소 시크릿으로 이미 설정됨) / `DRIFT_LABEL` /
  `DRIFT_ISSUE_TITLE` / `DRIFT_DRY_RUN` — 시크릿 이름을 바꾸려면 값을 다시 넣어야 해서
  사용자 조작 없이는 옮길 수 없다.
- JSON 리포트의 상태 값 `ok`/`drift`/`error`와 키 `summary.drift` — 알림 스크립트와
  사용자 스크립트가 읽는 기계 계약.
- 이전 메모리 레코드의 본문(append-only 규칙) — 옛 이름이 남아 있는 것은 정상이며,
  이름 변경 사실은 이 레코드가 담당한다.
