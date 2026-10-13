---
id: 2026-10-13-nsm-likms-migration-review
type: task
title: NsmLmSts → Likms 최종 구조 점검 — "생성자만 교체"가 성립하는 범위와 남은 문제 4개
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [nsm, likms, adapter, compat, review]
supersedes: 2026-10-13-likms-pending-scan
superseded_by: 2026-10-13-likms-committee-code-endpoint
---

## 문제

`NsmLmSts`(국민참여입법센터)를 쓰는 외부 프로젝트가 **작은 수정만으로** `LikmsNsmAdapter`
(국회 의안정보시스템 계류의안)로 갈아탈 수 있는가 — 구조를 최종 점검하고 남은 문제를 정리한다.

## 사실 (실측 2026-10-13, dist로 실제 호출)

구조 결론은 앞선 감사 체인(`nsm-compat-audit` → `detail-port` → `likms-pending-scan`)과 같다.
이번 점검은 **컴파일은 통과하지만 결과·비용이 달라지는 항목**을 숫자로 확정한 것이 추가분이다.

| 항목 | NsmLmSts | LikmsNsmAdapter | 성격 |
|---|---|---|---|
| 목록 5개 메서드 + 네트워크 설정 | 기준 | 시그니처·필드 집합 동일 | 생성자만 교체로 동작 |
| 상세 3개 메서드 | 기준 | `INsmDetailCrawler`로 동작(값 형식만 다름) | 타입 교체로 동작 |
| `searchPending`/`getAllPendingPages` | 서버 필터(`rslRsltNmL=900101`) | 스캔 + `progressStatus === '접수'`, `maxPages` 기본 10 | 같은 이름, 다른 비용·의미 |
| 스크린샷 계열(전용 2개 + `ScreenshotBase` 멤버) | `ScreenshotBase` 상속 | 없음 | 추가 구현 필요 |
| 기본 페이지 크기 | 20건 | 50건(`rows` 미지정) | 조용한 차이 |
| `pageSize` 허용값 | **임의 값 반영**(13 → 13건/1,642p, 100 → 100건/214p) | **임의 값 반영**(13 → 13건/1,227p, 25 → 25건/638p, 200 → 200건/80p) | 같음(문서만 정해진 집합으로 적혀 있었음 → 정정) |
| 총계(같은 조건) | 21,336건 | 15,950건(319p) | corpus가 다름 — 비교 불가 |
| 제안일자 필터 | `YYYYMMDD` 필요. `20260901` → 888, `20260901~0910` → 346(양끝 적용). **`2026-09-01`(ISO) 시작만 → 5,903(범위 불명), ISO 양쪽 → 0건** | `2026-09-01~2026-10-13` → 806, **한쪽만 주면 무시**(15,950) | 양쪽 필터가 서로 다른 형식 |
| `hydrateProposalReason` | 플래그 건마다 상세 요청 | 동일(3건 10.9s vs 2.1s) — 값은 `INsmBillItem`에 없음 | 어댑터 경유 시 비용만 증가 |

- 무시되는 필터(`rslRsltNmL`/`rslRsltNmR`/`cptOfiOrgCd`/`scCptPpostCmt`/`sortCol`/`issLawitmYn`/
  `stDt`/`edDt`)는 **필터가 빠진 전체 결과**를 돌려준다. `scPpsUsr`만 예외를 던진다.
- likms가 실제로 갖고 있는데 `ILikmsStateQuery`에 노출되지 않은 축: `cmtResultCd`(소관위 처리결과
  계류/가결/부결/폐기), `jntPrpslYn`. `cmtResultCd`는 앞선 감사에서 실측 동작을 확인한
  필터다(계류 14,972 / 가결 55 — `2026-10-13-nsm-compat-audit`).
- `ScreenshotBase.takeScreenshot(url)`은 URL을 연다. likms 목록은 GET URL로 질의를 표현할 수 없고
  (AJAX POST가 만든 조각을 렌더한다) 스크린샷 기반에 "HTML을 그려서 찍는" 경로가 없다.

## 결론/행동

- 점검 완료: "생성자만 교체"는 **목록+상세**까지 성립하고, pending·스크린샷·무시되는 필터·
  값 형식이 남은 작업이다. 문서는 [README.md](../../README.md)의 어댑터 절(쿼리 매핑 표,
  "NsmLmSts에서 교체할 때")과 `src/nsm-compat.test.ts`의 감사 헤더에 실측치까지 반영했다.
- 남은 문제(우선순위 순):
  1. **무시되는 필터가 조용히 전체 결과를 준다** — `scPpsUsr`처럼 예외를 던져야 하는 후보:
     `rslRsltNmL`/`rslRsltNmR`(심사·의결현황), `cptOfiOrgCd`(소관부처), `scCptPpostCmt`(상임위),
     `issLawitmYn`, `stDt`/`edDt`, 그리고 **한쪽만 준** 제안일자.
  2. `scCptPpostCmt`(상임위 **이름**) → likms `ageCmtId`(코드) 매핑 부재. 이름→코드 표를 만들면
     필터를 살릴 수 있다(무시 대신 매핑 가능).
  3. `searchPending`의 `maxPages` 기본 10 — NSM에는 없는 상한이라 결과가 조용히 잘리거나 빈손이 된다.
  4. 스크린샷 대응 없음 — likms 질의는 URL로 표현되지 않으므로 `ScreenshotBase`에
     HTML(`setContent`) 렌더 경로를 추가해야 어댑터가 동등한 결과를 찍을 수 있다.
- NSM 쪽 별건(마이그레이션 전에도 문제): `searchStDtNew`가 `YYYYMMDD`만 정상 해석한다.
  ISO로 호출하던 코드는 지금도 0건/5,903건을 받고 있다 — 크롤러에서 정규화하거나 문서에 명시할 것.
