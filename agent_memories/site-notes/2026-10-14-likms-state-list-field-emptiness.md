---
id: 2026-10-14-likms-state-list-field-emptiness
type: site-note
title: likms 계류의안 1페이지 필드별 값 존재율 — 소관위는 회부 전이면 빈 값이 정상
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [likms, drift]
supersedes: null
superseded_by: null
---

## 문제

드리프트 점검에 "이 필드는 채워져 있어야 한다"는 계약을 넣으려면 **어느 필드가 원래
비어 있을 수 있는지** 알아야 한다. 모르고 넣으면 매일 오탐이 뜬다(같은 실수를 한 번 했다:
[2026-10-14-drift-contract-empty-value-cases](2026-10-14-drift-contract-empty-value-cases.md)).

## 사실 (2026-10-14 실측, `LikmsStateCrawler#search({pageSize: 50})` 1페이지 50건)

| 필드 | 값 있는 건수 | 비고 |
|------|------|------|
| `billNo` · `billId` · `billName` · `proposer` · `proposerKind` · `proposalDate` · `progressStatus` · `link` | 50/50 | 계약으로 "채워짐"을 요구해도 된다 |
| `committee` | 38/50 | **위원회 회부 전(`progressStatus: "접수"`)이면 빈 문자열** — 소스 주석에도 명시되어 있다(`ILikmsStateBillItem`) |
| `hasProposalReason` (팝업 링크) | 49/50 | 건별로 다르다 |
| `proposalReason` | 0/50 | 목록 HTML에는 본문이 없다(`hydrateProposalReason` 옵트인으로만 채워진다) |

- `proposalDate` 형식은 `YYYY-MM-DD`(`2026-10-13`), `proposerKind`는 `의원`/`정부` 등.
- 1페이지 50건 전부 `progressStatus: "접수"`인 구간도 있어(제안 직후) 회부 전 비율이
  페이지에 따라 크게 달라진다 → "빈 값이 몇 건 이상"으로 단언하면 안 된다.
- 반대로 `hasProposalReason`이 **한 건도 잡히지 않으면** 이상 신호다. 이 값은 목록의
  `a[onclick*="openSummaryPopup"]` 존재 여부로 결정되므로, onclick 이름이 바뀌면 전부
  `false`가 되어 likms 제안이유 보정 경로가 조용히 꺼진다 — 그래서 점검은 "0건이면 drift"로
  본다(`likms.listCoverage`).

## 결론/행동

- likms 목록 계약에서 `committee`는 "채워짐"을 요구하지 않는다. 파싱이 통째로 죽었는지는
  비율(예: 0/50)로 판단한다.
- `hasProposalReason`은 0건이면 실패로 본다 — 유일하게 잡히는 "조용한 경로 단절" 신호다.
- 새 계약을 넣기 전에 이 표처럼 페이지 단위 실측으로 비어 있을 수 있는 자리를 확인한다.
