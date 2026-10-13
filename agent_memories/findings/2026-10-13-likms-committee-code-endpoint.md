---
id: 2026-10-13-likms-committee-code-endpoint
type: finding
title: likms 소관위 코드는 /bi/bill/sch/findAgeCmt.do JSON에서 얻는다 — 이름→코드 해석과 처리결과·공동발의 필터
status: active
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, nsm, adapter, committee, filter]
supersedes: 2026-10-13-nsm-likms-migration-review
superseded_by: null
---

## 문제

어댑터가 버리던 NSM `scCptPpostCmt`(상임위 **이름**)를 살리고, likms에는 있지만
`INsmSearchQuery`에 없던 `cmtResultCd`(소관위 처리결과)·`jntPrpslYn`(공동발의 여부)를 노출한다.
앞선 점검 기록의 "남은 문제 2번"에 대한 작업이다.

## 사실 (실측 2026-10-13)

- 계류의안 페이지의 소관위 select(`#ageCmtCd_sch`)는 **옵션이 '전체' 1개뿐**이다. 값은 대수
  select 변경 시 JS가 채운다(`navigation.js`의 `findAgeCmt` → `ageCmtList` 렌더). 그래서
  페이지 HTML만 봐서는 코드값을 알 수 없었다.
- 엔드포인트: `GET https://likms.assembly.go.kr/bill/bi/bill/sch/findAgeCmt.do`
  — **`/bill` 컨텍스트 경로가 필요하다**(없으면 안내용 HTML 페이지만 온다). 쿠키·CSRF 불필요.
- 응답: `{"ageCmtList":[{"comCd":"9700006","comCdName":"법제사법위원회","cdOrd":3002}, ...]}`
- 범위 파라미터는 **둘 다** 줘야 적용된다: `ageFrom=22&ageTo=22` → 25건(22대),
  `ageFrom=21&ageTo=22` → 26건. 한 쪽만 주면 무시되고 109건(전체 대수 합집합)이 온다.
  전체 목록에서는 같은 이름이 대수 꼬리표로 구분된다:
  `보건복지위원회(18대~22대)`=9700341 / `보건복지위원회(14대~17대)`=9700041,
  `교육위원회(20대~22대)`=9700512, `행정안전위원회(18대~19대)`=9700302.
- 검색 폼의 select 값(실측): `cmtResultCd` = `PRC_0000`(계류) · `PRC_0011`(폐기) ·
  `PRC_0013`(가결) · `PRC_0014`(부결), `jntPrpslYn` = `Y`/`N`(그 외 '전체'), `rows` = 10/20/30/50/100.
- 필터 실측(계류의안 탭, 같은 시점): 전체 **15,950** / `ageCmtId=9700006`(법사위) **1,618** /
  `cmtResultCd=PRC_0000`(계류) **15,547** — 즉 계류의안 탭에도 이미 처리된 403건이 섞여 있다 /
  `jntPrpslYn` Y **163** + N **15,787** = 15,950(정확히 둘로 분할).
- 어댑터 경유 실측: `scCptPpostCmt='법제사법위원회'` + 22대 → 1,571건(페이지 항목의
  `committee`가 모두 일치), `보건복지위원회` + 22대 → 1,292건, 범위 없이 `보건복지위원회` →
  예외(코드 2개), 목록에 없는 이름 → 예외.

## 결론/행동

- 구현: `LikmsStateCrawler.findCommittees(ageFrom, ageTo)`(+ `LikmsStateParser.parseCommittees`,
  `ILikmsCommittee`), `ILikmsStateQuery.cmtResultCd`/`jntPrpslYn`, 어댑터의 `scCptPpostCmt` →
  `ageCmtId` 해석(대수 범위별 목록 캐시, 꼬리표·공백 무시 비교, 미해석·동명이면 **요청 전** 예외).
- 원칙 유지: **사이트가 확정 목록을 주는 축만 해석**한다. 같은 이름이 여러 코드면 추측하지 않고
  예외로 알린다(호출부가 `ageCmtId`를 직접 주거나 `sugCd`/`endSugCd`로 좁힌다).
  범위를 반쪽만 주면 서버가 무시하므로 `findCommittees`가 먼저 막는다.
- 검증: 오프라인/라이브 `scripts/verify-dist.js` 17/17·27/27, 라이브 스위트(`LIKMS_LIVE_TEST=1`)
  11/11(새 검사 3건: 소관위 목록·코드 좁힘, `cmtResultCd`/`jntPrpslYn` 분할, 어댑터 이름 해석).
- 남은 문제(이전 점검 기록에서 갱신, 2번은 해소): (1) 나머지 무시 필터(`rslRsltNmL`/`rslRsltNmR`,
  `cptOfiOrgCd`, `sortCol`, `issLawitmYn`, `stDt`/`edDt`, **한쪽만 준 제안일자**) (3) pending 스캔의
  `maxPages` 기본 10 (4) 스크린샷 대응 없음(`ScreenshotBase`에 HTML 렌더 경로 필요).
