---
id: 2026-10-13-likms-state-proposer-filter
type: finding
title: likms 계류의안 검색 파라미터 — rows/ordCd/기간은 단독 적용, 발의자 필터는 폼 전체+ID+발의구분 필요
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, state-crawler, search-params]
supersedes: 2026-10-13-likms-state-paging-params
superseded_by: 2026-10-13-drop-likms-represent-name-resolution
---

<!-- 문제 → 사실 → 결론/행동 순서로. 근거(커밋 해시·파일 경로·명령어 출력)를 남길 것. -->

## 문제

`LikmsStateCrawler`(의안현황 > 계류의안, `searchBillStatePaging.do`)에서 어떤 검색
파라미터가 실제로 걸리는지 확정해야 했다. 특히 `NsmLmSts`의 제안자명 필터(`scPpsUsr`)를
어댑터에서 매핑할 수 있는지, 발의자 관련 필드를 어떻게 보내야 하는지가 미지수였다.

## 사실

실사이트 POST 프로브 + `billState.js` / `navigation.js` 소스 확인 결과:

- 최소 본문(`page`, `rows`, `stateId`, `stateDtlDivCd`)만으로 단독 적용되는 파라미터:
  `billNm`, `billNo`, `proposerKind`(GOV/MEMASEMBY/CHRPR), `ageFrom`/`ageTo`,
  `rows`(페이지 크기), `ordCd`(ASC/DESC), `listOrd`. `billNo`는 정확 일치.
- `fromPropDt`/`toPropDt`는 **양쪽 모두** 줄 때만 적용된다. 한쪽만 보내면 무시(전체 조회).
- **발의자명(`represent`)은 서버가 아예 보지 않는다.** 브라우저는
  `POST /bi/bill/sch/checkSameNm.do`(`ageFrom`, `ageTo`, `memName`, `classId=bill`)로
  `{membCnt, membId}`를 받아 `#representId`를 채운 뒤 검색한다(`navigation.js`
  `checkSameMemb`). `ageFrom`/`ageTo`가 비면 `membCnt: 0`을 돌려준다.
  - `문진석` (대수 22) → `{"membId":"4U29186R","membCnt":1}`
  - `김진표` → 대수 22 범위에서는 `membCnt: 0`(제21대 인물), `1~22` 범위에서는 1
- `representId`만 붙인 최소 본문은 **무시된다**(전체 건수 그대로). 같은 `representId`도
  페이지 `#form` 숨김 필드 전체(`isPopSelect`, `anbillDivCd`, `menuNo`, `repreNm` 등)를
  본문에 깔고 `representKindCd`를 함께 보내면 적용된다.
  - 대수 22 기준: `representId=4U29186R&representKindCd=REPR` → 146,
    `SING` → 0, `COMM` → 1,060, `전체` → 1,206(=REPR+COMM), 발의구분 없이 ID만 → 15,224(무시).
- 검증: 같은 페이지의 숨김 필드를 깔아도 기존 단독 파라미터 결과는 동일했다
  (mooring 15,224 / finish 6,760 / suggest 35 / beforePropose 28 — 최소 본문과 완전 일치).
  즉 폼 기반 본문은 회귀 없이 발의자 필터만 추가로 켠다.
- `#pager_pages_text`의 전체 페이지 수에는 천 단위 쉼표가 들어간다(`(1/1,595 페이지)`).
- 검색 엔드포인트는 CSRF 토큰을 검증하지 않는다(위조/무헤더도 200).

> 정정: 아래 `represent`(발의자명) 자동 해석은 확정 값을 주지 못해 제거됐다
> (ID 직접 지정 + 후보 조회만 유지) → decisions/2026-10-13-drop-likms-represent-name-resolution.
> 파라미터 실측(폼 숨김 필드·ID 셋트 조건·페이지 수 쉼표 등)은 그대로 유효하다.

## 결론/행동

- 크롤러 본문은 세션 페이지의 `#form` 숨김 필드를 기본값으로 깔고 요청 조건으로 덮어쓴다
  (`LikmsStateCrawler.parseStateFormParams` / 세션 캐시). 이게 브라우저와 동일한 방식이며
  발의자 필터를 켜는 유일한 방법이다.
- 발의자명은 `resolveRepresentId()`(`checkSameNm.do`)로 해석한다. 결과는 캐시하고,
  명단에 없으면 검색을 호출하지 않고 0건을 반환, 동명이인(`membCnt > 1`)이면 예외를 던진다.
- `representId`를 직접 줄 때는 `representKindCd`를 함께 보내야 한다(없으면 자동 '전체').
- 목록의 제안자 표기는 **대표발의자**이므로, `representKindCd='전체'` 결과의 `proposer`가
  찾는 이름과 다를 수 있다(공동발의 건). 표기와 일치하는지 확인하려면 `REPR`로 좁혀 본다.
- 따라서 `LikmsNsmAdapter`의 `scPpsUsr` → `represent` 매핑은 유효하다(문서: README
  "LikmsNsmAdapter" 절).
