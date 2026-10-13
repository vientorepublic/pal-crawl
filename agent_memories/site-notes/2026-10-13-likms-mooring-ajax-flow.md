---
id: 2026-10-13-likms-mooring-ajax-flow
type: site-note
title: likms 계류의안 목록은 CSRF 헤더가 필요한 AJAX POST로 채워짐
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, csrf, ajax]
supersedes: null
superseded_by: 2026-10-13-likms-state-csrf-not-enforced
---

## 문제

국민참여입법센터(NsmLmSts)를 대체할 계류의안 수집 경로로
`https://likms.assembly.go.kr/bill/bi/bill/state/mooringBillPage.do`를 쓰기 위해,
목록이 AJAX로 채워지는 실제 엔드포인트·파라미터·CSRF 처리 방식을 확정해야 했다.

## 사실

- 페이지는 목록을 정적으로 담지 않고 AJAX로 채운다. 관련 스크립트는
  `/bill/static/js/bi/state/billState.js`, `/bill/static/js/common/commonHelpUtil.js`,
  `/bill/static/js/bi/biInit.js`.
- 흐름 (billState.js `app.Act.search`):
  1. `GET /bill/bi/bill/state/mooringBillPage.do?stateId=mooring` → 세션 쿠키(JSESSIONID)와
     `<meta name="_csrf" content="...">` 토큰을 같이 받는다(숨김 폼 `input[name=_csrf]`에도 동일 값).
  2. `POST /bill/bi/bill/state/searchBillStatePaging.do` (URL-encoded 폼 본문).
     헤더 `X-CSRF-TOKEN: <토큰>` 필요. `com.help.ajax`는 axios 인터셉터에서
     `config.headers['X-CSRF-TOKEN'] = CSRF_TOKEN` 로 항상 이 헤더를 붙인다
     (commonHelpUtil.js `setCsrfHeaders`, 상수 `CSRF_HEADER_NAME = 'X-CSRF-TOKEN'`).
     컨텍스트 경로는 `/bill` (`glb_ctxPathJS = '/bill'`, `com.help.url`이 prefix).
  3. 응답은 JSON이 아니라 `<div id="state-list">` 목록 **조각 HTML**.
     총 건수는 `#pager_count_text`(예: `15,947`), 현재/전체 페이지는
     `#pager_pages_text`(예: ` (1/319 페이지)`) 숨김 input에서 읽는다.
- 행 구조: `td.billNo`(title=의안번호), `td.align_left a[data-bill-id]`(billId=PRC_...,
  title=의안명), `td.proposerKindName`(제안자구분), `td.proposeDt`(제안일자),
  5번째 td의 `a[onclick*=openSummaryPopup]`(제안이유 존재 여부),
  `td.currCmt`(소관위원회), `td.procStageName`(심사진행상태).
- 최소 본문(`page=1&stateId=mooring&stateDtlDivCd=all`)만으로 응답 확인:
  total=15,947 / totalPages=319 → 페이지당 50건. 필터는 `billNm`, `billNo`,
  `representKindCd`, `represent`, `ageCmtId`, `ageFrom`, `ageTo`, `billKind`,
  `listOrd`, `ordCd`, `fromPropDt`, `toPropDt`, `nmReSchText` 등.
- CSRF 토큰은 세션 동안 유지된다(같은 토큰으로 연속 POST 성공). 따라서 매 요청마다
  페이지를 다시 받을 필요가 없다.
- 상세 페이지는 `/bill/bi/billDetailPage.do?billId=PRC_...` (기존 LikmsCrawler의
  `getProposalReason`이 쓰는 경로와 동일 ID 체계).

## 결론/행동

`LikmsStateCrawler`(src/likms.ts) + `LikmsStateParser`(src/parser.ts)가 이 흐름을 구현한다.
CSRF 토큰은 첫 요청에서 1회 발급해 캐시하고, 실패 시 세션을 재발급해 1회 재시도한다.
HttpClient는 `Set-Cookie`를 세션 동안 보관하는 쿠키 저장소와 요청별 `headers` 인자를
추가로 지원한다. 사이트가 Spring CSRF 헤더명(`X-CSRF-TOKEN`)이나 엔드포인트를 바꾸면
`Config.LIKMS_CSRF_HEADER` / `LIKMS_STATE_*_URL`와 위 셀렉터를 함께 점검할 것.
