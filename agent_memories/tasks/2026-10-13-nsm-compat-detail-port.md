---
id: 2026-10-13-nsm-compat-detail-port
type: task
title: LikmsNsmAdapter 상세 조회 포트(INsmDetailCrawler) 추가 — 교체 가능 범위 확대
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [nsm, likms, adapter, compat, detail]
supersedes: 2026-10-13-nsm-compat-audit
superseded_by: 2026-10-13-likms-pending-scan
---

## 문제

직전 감사(`2026-10-13-nsm-compat-audit`)는 `parseDetail` / `getDetailHTML` / `getDetail`을
“likms에는 대응이 없다”로 분류했다. 상세를 쓰던 외부 호출부도 교체할 수 있어야 한다.

## 사실

- likms 의안상세는 응답이 둘로 나뉜다.
  1. `GET /bill/bi/billDetailPage.do?billId=PRC_...&currMenuNo=2600044`
     → 제목(`h3.detailh3`, `[2221883] ...(주진우의원 등 10인)`), 숨김 폼(`#form`)
  2. `POST /bill/bi/bill/detail/billInfo.do` (숨김 폼 직렬화)
     → `#insc-rcp-row`: `td.billNo`·`td.proposeDt`·`td.proposer`·`td.sessionTitle`·`td.doc`,
       `#prntSummary`(제안이유), `td.doc a`(의안원문 한글/PDF)
- 의안번호 → billId 해석은 `GET /bill/bi/common/findBillDetail.do?billNo=...`.
  **`/bill` 컨텍스트 경로가 필요하다** — 없으면 307 Temporary Redirect(실측).
- 문서 링크는 `href="javascript: goDownload('/filegate/servlet/FileGate?bookId=...&type=0')"`(한글),
  `/filegate/servlet/FileGate?...&type=1`(PDF) 형태이며, 미리보기 링크는 `href="javascript:;"`라
  다운로드 URL이 없다.
- 실측(2026-10-13, dist로 실제 호출):
  - `2221883` → billId `PRC_6476A403F8E64D14A9F1D6E1B2B570`, 제안자 `주진우의원 등 10인`,
    제안일자 `2026-10-13`, 회기 `제22대(2024~2028)제439회`, 제안이유 1,560자, 첨부 0건
  - `PRC_J2F6M0Q9B1N6M1N3S3I8M2Y5V2S0L7`(처리의안) → 의안번호 `2221667`, 제안이유 1,050자,
    의안원문 hwp/pdf 2건이 URL로 채워짐
  - billId 직접 전달과 의안번호 전달의 결과가 동일함

## 결론/행동

- 새 포트 `INsmDetailCrawler`(`getDetailHTML`/`parseDetail`/`getDetail`)를 추가했고
  `NsmLmSts`·`LikmsNsmAdapter` 둘 다 만족한다(컴파일 타임 `keyof 포트 ⊆ keyof NsmLmSts` 검증).
- 파싱은 `LikmsDetailParser`(parser.ts)가 맡는다. 상세 페이지 HTML과 심사정보 조각 HTML을
  **둘 다** 받아 들어 있는 값만 채운다(`LikmsCrawler.parseProposalReason`은 이 파서에 위임).
- 값 형식 차이는 문서화된 한계다: `proposalDate`(`2026. 5. 1.` ↔ `2026-10-13`),
  `session`(`제435회 국회(임시회)` ↔ `제22대(2024~2028)제439회`),
  `attachments[].fileId`(숫자 ID ↔ 다운로드 URL), `proposalInfo`(likms는 접수정보로 조합).
- 없는 의안번호면 `Error('bill not found: ...')`를 던진다(NSM은 빈 상세 반환) — 의도적 차이.
- 직전 감사에서 여전히 유효한 결론: `searchPending`/`getAllPendingPages`는 서버 필터가 없고,
  스크린샷 계열은 어댑터가 제공하지 않으며, 무시되는 필터(rslRsltNmL 등)와 페이지 크기 기본값
  (20건 ↔ 50건) 차이는 그대로다.
