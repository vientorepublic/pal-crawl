---
id: 2026-10-13-likms-pending-scan
type: task
title: likms 접수(발의 상태) 스캔 대안 + 상세 조회 포트 — 현행 요약
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [nsm, likms, adapter, compat, pending]
supersedes: 2026-10-13-nsm-compat-detail-port
superseded_by: 2026-10-13-nsm-likms-migration-review
---

## 문제

`NsmLmSts`에서 `LikmsNsmAdapter`로 갈아탈 때 남은 두 구멍(상세 조회, `searchPending`)을 메웠다.
이 레코드는 `2026-10-13-nsm-compat-detail-port`를 대체하며, 그 레코드의 여전히 유효한 내용을 함께 담는다.

## 사실

**상세 조회(`INsmDetailCrawler`)** — `getDetailHTML`/`parseDetail`/`getDetail`.
- likms 의안상세는 응답이 둘: 상세 페이지(제목·숨김 폼) + `billInfo.do` 조각(접수정보·제안이유·문서).
- 인자는 NSM과 같이 의안번호를 받고, `findBillDetail.do`(=`/bill` 컨텍스트 경로 필수, 없으면 307)로
  billId를 해석한다. 없는 의안번호면 `bill_not_found` 성격의 예외를 던진다(NSM은 빈 상세 반환).
- 값 형식 차이(문서화): `proposalDate`(`2026. 5. 1.` ↔ `2026-10-13`),
  `session`(`제435회 국회(임시회)` ↔ `제22대(2024~2028)제439회`),
  `attachments[].fileId`(숫자 ID ↔ 다운로드 URL), `proposalInfo`(likms는 접수정보로 조합).
- 실사이트 확인: 계류의안 1건(제안이유 1,560자), 첨부 보유 건 1건(의안원문 hwp/pdf URL 2건).

**접수(발의 상태) 대안(`searchPending`/`getAllPendingPages`)** — 새 작업.
- 서버 필터가 없어 목록을 앞에서부터 스캔해 `progressStatus === '접수'`만 남긴다.
  근거·코드값 탐색 실패 기록은 finding `2026-10-13-likms-srng-prgrs-stts-cd-filter`.
- 스캔 기본 페이지 크기 100건, `searchPending`의 기본 `maxPages` 10, 둘 다 옵션으로 조절.
- 접수 항목이 없는 페이지는 건너뛰므로 `currentPage`는 원본 페이지 번호가 아니고 `pageIndex`로 건너뛸 수 없다.
  `items`는 접수만, `total`/`totalPages`는 전체(접수 포함) 기준 원본 값이다.
- 포트(`INsmListCrawler`)에는 **넣지 않았다** — 서버 필터 대신 스캔이라 비용 특성이 달라서
  같은 인터페이스 뒤에 숨기지 않는다. 어댑터가 같은 이름의 메서드로 명시적으로 제공한다.
- 실사이트 확인: 5페이지(maxPages 5, rows 100) 스캔에서 접수 14건 수집, `searchPending` 12건.
  같은 시점 NSM `searchPending` 24건과 12건 일치(부분집합 관계 확인).

**여전히 유효한 이전 감사 결론**: 무시되는 필터(`rslRsltNmL`, `rslRsltNmR`, `cptOfiOrgCd`,
`scCptPpostCmt`, `sortCol`, `issLawitmYn`, `stDt`/`edDt`), 스크린샷 계열은 어댑터가 제공하지 않음,
기본 페이지 크기 차이(20건 ↔ 50건), `cmtResultCd`는 `ILikmsStateQuery`에 미노출.

## 결론/행동

- “생성자만 교체”가 성립하는 범위: 목록 조회 5개 + 상세 조회 3개 + 네트워크 설정.
  `searchPending`/`getAllPendingPages`는 같은 이름으로 부르되 **스캔 비용이 든다는 점을 인지**하고
  `delayMs`/`maxPages`를 정할 것.
- 다음 후보: `cmtResultCd`(+`jntPrpslYn`)를 `ILikmsStateQuery`에 노출,
  유효한 `srngPrgrsSttsCd` 코드값을 브라우저 개발자 도구로 확인하면 서버 필터로 교체(스캔 제거).
