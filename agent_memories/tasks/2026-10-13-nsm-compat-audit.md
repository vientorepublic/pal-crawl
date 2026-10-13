---
id: 2026-10-13-nsm-compat-audit
type: task
title: NsmLmSts → 계류의안(LikmsNsmAdapter) 교체 호환성 감사 결과
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [nsm, likms, adapter, compat]
supersedes: null
superseded_by: 2026-10-13-nsm-compat-detail-port
---

## 문제

기존 `NsmLmSts`(국민참여입법센터)를 쓰는 외부 프로젝트가 메서드·인자를 거의 고치지 않고
계류의안 크롤러(`LikmsNsmAdapter` + `LikmsStateCrawler`)로 갈아탈 수 있는가?

## 사실

감사 방법: `INsmListCrawler` 포트만 보고 쓴 동일 호출부 코드를 두 구현에 돌려 결과 **형태**를
비교(`src/nsm-compat.test.ts`의 `NsmLmSts 호환성 감사`), 컴파일 타임 검증
(`keyof INsmListCrawler ⊆ keyof NsmLmSts`, `PalCrawlConfig` → `LikmsStateCrawlerConfig` 대입),
실사이트 프로브.

**그대로 동작(시그니처 동일)**: `getListHTML`, `parseList`, `search`, `getPage`,
`getAllPages`. 결과 컨테이너/아이템의 필드 집합과 값 타입이 동일하다
(`INsmSearchResult`, `INsmBillItem` 11개 필드). 네트워크 옵션(userAgent/timeout/retryCount/
customHeaders/hydrateProposalReason)은 `PalCrawlConfig` 변수를 그대로 넘길 수 있다
(`screenshot`/`hydrateTruncatedTitles`는 조용히 무시).

**컴파일 오류로 드러남(수정 필요)** — `NsmLmSts`에만 있는 멤버:
- `parseDetail`, `getDetailHTML`, `getDetail`: likms 계류의안에는 상세 파서가 없다
  (제안이유만 `LikmsCrawler.getProposalReason`).
- `searchPending`, `getAllPendingPages`: 서버 필터가 없다. 실측으로 `progressStatus`,
  `procStageCd`, `cmtResultCd`(축이 다름) 등 어떤 파라미터도 심사진행상태를 좁히지 못했다.
  대안은 전체 수집 후 `progressStatus === '접수'`(회부 전) 클라이언트 필터 — 전 페이지 스캔 필요.
- `getNsmListScreenshot`, `getDetailScreenshot` 및 `ScreenshotBase` 멤버
  (`initBrowser`/`closeBrowser`/`takeScreenshot`/`updateScreenshotConfig`/`browser`):
  어댑터는 스크린샷 기반을 상속하지 않는다. likms 계류의안 페이지는 목록을 AJAX로 채우므로
  정적 스크린샷 가치도 낮다.

**조용히 무시되는 인자(수정 없이 컴파일됨 → 호출부 점검 필요)**: `rslRsltNmL`, `rslRsltNmR`,
`cptOfiOrgCd`, `scCptPpostCmt`, `sortCol`, `issLawitmYn`, `stDt`/`edDt`.
likms에 없는 축이거나(국회현황, 소관부처, 추진일자) 값 체계가 다르다(`sortCol`).
`rslRsltNmR`(의결현황: 본회의 결과)과 likms `cmtResultCd`(소관위 처리결과: 계류/가결/부결/폐기)는
축이 달라 매핑하지 않았다. 참고로 `cmtResultCd`는 실측으로 동작하는 likms 필터인데
`ILikmsStateQuery`에 아직 노출돼 있지 않다(계류 14,972 / 가결 55).

**값 형식·어휘 차이(문자열 비교하는 호출부는 수정 필요)**:
- `progressStatus`: NSM `발의`/`위원회 회부` ↔ likms `접수`/`위원회 심사`/`본회의부의안건`.
- `billName`: NSM은 발의자 괄호 제거, likms는 제목 전체(발의자 포함).
- `link`: 둘 다 절대 URL이지만 체계가 다름
  (`opinion.lawmaking.go.kr/gcom/nsmLmSts/out/{billNo}/detailRP` ↔
  `likms.assembly.go.kr/bill/bi/billDetailPage.do?billId=PRC_...`). URL 경로를 파싱하던 코드는 수정 필요.
- `ministry`/`progressDate`/`resolutionStatus`/`resolutionDate`: likms 목록에 없어 빈 문자열.
- 기본 페이지 크기: 국민참여입법센터 **20건/쪽**(실사이트 확인) ↔ likms **50건/쪽**.
  페이지당 건수에 의존하면 `pageSize`를 명시해야 한다.

**추가 요청 비용(호출부가 모르고 지나칠 수 있음)**: `scPpsUsr` 사용 시 이름→ID 해석 POST 1회
(`checkSameNm.do`, 결과 캐시), `hydrateProposalReason: true`면 플래그 건마다 2회 요청.

## 결론/행동

- “생성자만 교체”가 성립하는 범위는 목록 조회 5개 메서드 + 네트워크 설정이다. 상세·스크린샷·
  pending 계열을 쓰는 프로젝트는 추가 작업이 필요하므로 위 목록을 먼저 확인할 것.
- 호출부 점검 체크리스트: (1) pending/상세/스크린샷 사용 여부, (2) 무시되는 필터 의존 여부,
  (3) `progressStatus`/`billName`/`link` 문자열 비교 여부, (4) `pageSize` 명시 여부.
- 후속 후보: `ILikmsStateQuery`에 `cmtResultCd`(+`jntPrpslYn`) 노출, `searchPending` 대안
  (클라이언트 필터 헬퍼), 어댑터의 상세 조회 부재 문서화.
