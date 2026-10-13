---
id: 2026-10-13-likms-srng-prgrs-stts-cd-filter
type: finding
title: likms 계류의안 심사진행상태 필터(srngPrgrsSttsCd)는 존재하지만 쓸 수 있는 코드값을 알 수 없다
status: active
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, state, search, filter]
supersedes: null
superseded_by: null
---

## 문제

`NsmLmSts.searchPending`(서버 필터 `rslRsltNmL=900101` '발의')에 대응하는 likms 서버 필터가
있는지, 있으면 코드값이 무엇인지 실측했다. 이전 감사 기록
(`2026-10-13-nsm-compat-audit`, `2026-10-13-nsm-compat-detail-port`)의
“어떤 파라미터도 심사진행상태를 좁히지 못했다”는 결론을 정정한다.

## 사실

실측 방법: `mooringBillPage.do`로 세션·CSRF·`#form` 숨김 필드를 받은 뒤
`searchBillStatePaging.do` POST 본문에 후보 파라미터를 더해 `#pager_count_text`(총 건수)를 비교. (2026-10-13)

- **`srngPrgrsSttsCd`는 실제로 서버 조건이다.** 기준 15,950건에서
  - `srngPrgrsSttsCd=전체` → 15,950 (필터 없음)
  - 그 밖의 값(`RECEIVE`, `CMT`, `EXAM`, `MAIN`, `GOVTRANS`, `DCS`, `접수`, `소관위접수`, `PRC_*`, `PSC_*`, 숫자, `%`) → **0건**
  - `procStageCd`, `procStageName`, `progressStatus`, `stageCd`, `srngSttsCd`, `mainProcYn`, `stateDtlDivCd`(숫자·문자) 는 총 건수를 바꾸지 못함(무시됨). 참고로 `cmtResultCd=PRC_0000`(계류)는 15,547로 동작한다(축이 다름).
- **유효한 코드값을 얻을 수 없다.** 사이트 JS(`navigation.js`)는 `#srngPrgrsSttsCd_sch` select를
  숨김 데이터 소스 `#srngPrgrsStts_sch_data li`(`data-value`)로 채우지만, **그 데이터 소스가
  계류의안·처리의안·위원회안(대안)·본회의 부의안건·의안검색 어느 페이지에도 렌더되지 않는다**
  (데스크톱/모바일 UA, `?billKind=BKC_0004` 동반 모두). 의안상세의 심사진행단계 코드
  (`data-gbn`: `RECEIVE`/`CMT`/`EXAM`/`MAIN`/`GOVTRANS`/`DCS`)도 통하지 않는다.
  `%`가 통하지 않는 것으로 보아 LIKE가 아니라 등호 비교이며, 코드 테이블을 공개한 자료도 없다.
- **심사진행단계 어휘(실측)**: likms 계류의안 목록 `td.procStageName`의 실제 값은
  `접수`, `소관위접수`, `소관위심사`, `소관위상정`, `본회의부의안건` 등.
  (이전 기록의 `위원회 심사` 표기는 단일 fixture에서 온 부정확한 값이다.)
- **`접수` ≈ NSM `발의`**: likms 계류의안 표본(498건)의 `접수` 13건 중 12건이
  NSM `rslRsltNmL=900101` 결과 24건에 포함. 행 단위 대조(500건 스캔)에서도 14건 중 12건 일치.
  `소관위접수`(460건)는 위원회 회부 이후라 `발의`가 아니다.
- 계류의안 목록에는 임시대안 성격의 `ZZ…` 의안번호 행도 섞일 수 있다(NSM 쪽에는 없다).

## 결론/행동

- 서버 필터는 **쓰지 않는다.** `LikmsStateCrawler`/`LikmsNsmAdapter`는 목록을 앞에서부터 스캔해
  `progressStatus === '접수'`로 거른다(`searchPending`, `getAllPendingPages`).
- 나중에 유효 코드값을 알게 되면(브라우저 개발자 도구로 실제 옵션을 확인하는 방법이 가장 확실)
  이 finding을 supersede하고 서버 필터로 바꿀 것 — 스캔 비용이 사라진다.
