---
id: 2026-10-14-drift-contract-manifest
type: decision
title: 드리프트 계약을 선언적 매니페스트로 분리하고 src 대조로 강제한다
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [ci, drift, scripts, convention]
supersedes: null
superseded_by: null
---

## 문제

[2026-10-14-site-drift-daily-ci-check](../tasks/2026-10-14-site-drift-daily-ci-check.md)의
점검기는 계약(선택자·엔드포인트·필드 형식)을 `scripts/check-site-drift.js` 안의
명령형 점검 함수에 인라인으로 들고 있었다. 그래서 **파서를 고칠 때 점검기 쪽 기대값을
같이 고쳐야 한다는 사실이 diff에 드러나지 않았다** — 사이트 리뉴얼 대응 PR에서 파서만
고치고 계약은 낡은 채로 두면, 다음 정기 점검이 오탐(또는 미탐)을 낸다.

## 사실

- 계약을 데이터로 분리해도 "파서만 고치는" 문제는 사라지지 않는다. 분리와 **동시에
  어긋남을 강제하는 장치**가 필요했다.
- 선택자는 소스에서 기계적으로 뽑을 수 있다 — `$('…')`/`.find('…')`/`.closest('…')` 인자와
  `.`·`#`로 시작하는 문자열 리터럴. `src/` 6개 파일(테스트 제외)에서 페이지 특이 선택자
  44개가 나오고, 그중 12개는 합성(`.board-added table thead th`처럼 소스에는 조각으로만
  존재)이라 in-source 문자열 대조가 성립하지 않는다 → 합성 선택자는 `usedBy`를 두지 않는다.
- 엔드포인트는 이미 전부 `Config` 상수다(`/napal/...`, `findAgeCmt.do`, CSRF 헤더명 등).
  경로 문자열을 계약에 복사하면 이중 관리가 되므로 **상수 이름을 참조**하게 했다.
- 실행기 구조: `kind: dom | parse | flow`. 흐름이 필요한 것은 5개뿐이었다 —
  likms 위원회 JSON · 필터가 실제로 좁히는지 · 상세 2단계(AJAX 조각) · 동명이인 후보 ·
  PAL→likms 교차. 나머지 13개는 데이터만으로 표현된다(`dom`/`parse` + 필드·관계식).
- 실측 오탐 2건을 리팩터링 중에 새로 만들었다(다음 정기 점검 전에 걷어냄):
  - `items[].x` 경로는 항목이 없으면 확인할 것이 없는데 실패로 셌다 → 다중 경로는
    비어 있으면 통과(목록 크기는 `items.length` 계약이 따로 본다).
  - likms 목록의 `committee`는 **회부 전이면 빈 값이 정상**(1페이지 50건 중 12건),
    `proposalDate`/`proposerKind`는 50/50 채워진다. 자세한 필드별 값 존재율은
    [2026-10-14-likms-state-list-field-emptiness](../site-notes/2026-10-14-likms-state-list-field-emptiness.md).

## 결론/행동

- 계약은 `scripts/drift-contracts/`의 사이트별 매니페스트가 단일 진실원이다
  (형식·표기법: 같은 폴더 `README.md`). 실행기는 `scripts/check-site-drift.js`.
- `npm run drift:contracts`가 두 방향을 강제한다(PR CI + 정기 워크플로에 연결).
  1. 매니페스트 → 소스: `usedBy`가 적힌 문자열이 그 파일에 실재해야 한다.
  2. 소스 → 매니페스트: 페이지 특이 선택자는 모두 선언되어야 한다.
  → 파서 변경과 계약 변경이 같은 PR에 묶인다(둘 중 하나만 하면 게이트 실패).
- 새 점검을 추가할 때: `kind`를 먼저 고르고, 기대값은 매니페스트에, 흐름 코드는
  실행기의 `FLOWS`에 둔다. 실사이트에서 확인하지 않는(조건부·제거용) 선택자는
  `live: false`, 값이 없어도 되는 자리는 `optional: true`를 쓴다.
- 오탐 방지 규약은 그대로다(빈 값이 정상인 자리는 계약에 넣지 않는다). 계약을 늘릴 때는
  실측으로 확인한 뒤 넣는다.
