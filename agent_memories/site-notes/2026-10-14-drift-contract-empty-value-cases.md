---
id: 2026-10-14-drift-contract-empty-value-cases
type: site-note
title: 빈 값이 정상인 자리 실측 — 드리프트 점검 초기 오탐 4건(NSM 빈 셀·PAL 빈 제안이유·likms 비숫자 코드·문서 없는 건)
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [pal, nsm, likms, drift, parser]
supersedes: null
superseded_by: null
---

## 문제

`scripts/check-site-drift.js`의 첫 실사이트 실행에서 4개 항목이 drift로 잡혔는데
(2026-10-14), 사이트를 직접 확인하니 전부 **내가 세운 계약이 과했다** — 실제 페이지에서
정상적으로 빈 값이거나 구조가 다른 자리였다. 같은 오탐을 다시 만들지 않도록 실측을 남긴다.

## 사실 (2026-10-14 실측, 캡처 근거)

- **NSM 목록: 값이 없는 셀은 안쪽 `p` 자체가 없다.** 셀(`td[data-th=...]`)은 항상 있지만
  값이 없으면 `<td data-th="상임위원회(소관부처)"> </td>`처럼 **빈 셀**만 남는다.
  그래서 `td[...] p`를 필수로 걸면 오탐이 난다 — 셀 존재까지가 DOM 계약이고, 필드 채움은
  파싱 결과(`proposer`·`progressStatus`가 채워지는지)로 보는 것이 맞다.
  컬럼은 6개다: `의안명` / `제안자(제안일자)` / `상임위원회(소관부처)` / `국회현황(추진일자)` /
  `의결현황(의결일자)` / **`의안번호 (대안번호)`**(파서는 쓰지 않음).
- **PAL 상세: 제안이유 섹션이 있어도 본문이 비어 있을 수 있다.** 첫 건의 `.card-wrap .item`
  h4는 `제안이유 및 주요내용`인데 `.desc`가 **0자**였고, 같은 페이지에 h4가 **빈 item**도 있다
  (섹션 목록: `제안이유 및 주요내용`, `의견제출방법`, `` ). 이때 `parseContent().proposalReason`은
  `null`이 정상이며 그게 `hydrateProposalReason`(likms 보정)이 존재하는 이유다.
  → drift로 볼 것은 "본문이 있는데 파싱이 null"인 경우뿐이다.
- **likms 소관위 코드에 숫자가 아닌 값이 섞인다.** `findCommittees(22,22)` 25건 중
  `N999999`(이름 `미확정`)가 1건. `comCd`를 `/^\d+$/`로 강제하면 오탐 — 숫자 코드가
  다수를 차지하는지로 보는 편이 맞다(법제사법위원회 = `9700006`).
- **likms 접수 단계 의안에는 문서 링크가 없다.** 심사정보 조각에서 `td.doc` 셀은 항상 있으나
  아직 의안원문이 없으면 앵커가 없다(`<td class="doc align_left"><i>문서</i></td>`)
  → `parseAttachments` 결과 0건이 정상. `#prntSummary`(제안이유)는 접수 건에도 있다(1,572자 등).
- **`#form` 숨김 필드는 fixture보다 훨씬 많다.** 계류의안 페이지 19개
  (`page, menuNo, stateId, stateDtlDivCd, anbillDivCd, mainProcYn, isHistoryBack, ageFrom, ageTo,
  representId, isPopSelect, allOpenId, allNm, repreOpenId, repreNm, oneOpenId, oneNm, jointOpenId, jointNm`),
  의안상세 페이지 13개(`billId, billNo, billKindCd, currCmtName, reexamYn, mainUpdateBillYn,
  billGbnCd, tmprAnYn, headMemo, headMemoInfo, withdrawCnt, intrsBillCnt, stageMemo`).
  `src/*.test.ts` fixture는 3개만 담고 있으므로, 점검은 **필수 필드만** 단언하고 나머지는
  인벤토리로 리포트한다(사이트가 필드를 빼면 파싱이 빈 값이 되는 경로가 있어서다).

## 결론/행동

- 드리프트 점검에 계약을 추가할 때는 "이 자리가 비는 것이 정상인가"를 먼저 확인한다.
  비는 것이 정상인 필드는 **값이 아니라 DOM 요소(셀·섹션) 존재**까지를 계약으로 삼고,
  본문이 있는데 파싱이 비는 경우만 drift로 본다.
- 이 4건은 코드에 반영되어 현재 18/18 ok다(점검 설계·운영은
  [2026-10-14-site-drift-daily-ci-check](../tasks/2026-10-14-site-drift-daily-ci-check.md)).
