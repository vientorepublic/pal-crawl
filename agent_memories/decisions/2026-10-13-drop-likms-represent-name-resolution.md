---
id: 2026-10-13-drop-likms-represent-name-resolution
type: decision
title: likms 제안자명 자동 해석 제거 — 확정 값을 주지 못하는 이름 기반 경로는 남기지 않는다
status: active
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, api, decision, breaking-change]
supersedes: 2026-10-13-likms-state-proposer-filter
superseded_by: null
---

## 문제

`LikmsStateCrawler`가 제안자 **이름**을 받아 의원 ID로 바꿔 필터해 왔다
(`represent` → `checkSameNm.do` → `representId`). 그런데 이 해석은 확정 값을 주지 못한다:

- 같은 이름이 여러 대수에 있다(`주진우`: 22대 GJK57930 / 16대 IRT9826E).
- 같은 이름이 **같은 대수에** 있을 수도 있다(`이수진`: 21대 무소속 D4L60530 /
  21대 더불어민주당 0R68099X) — 대수만 좁혀서는 풀리지 않는다.
- 한자는 동일인 키가 아니다(`김문수` 22대·17대가 같은 金文洙).
- `checkSameNm.do`의 `membCnt`는 대수 범위에 따라 달라진다(`주진우` 01–99 → 2,
  22–22 → 1, 21–21 → 0). 즉 "해석 결과"는 호출자가 준 범위에 좌우된다.
- 명단에 없는 이름은 0건, 동명이인은 예외 — 둘 다 **데이터가 아니라 사정**을 돌려준다.

같은 이유로 어댑터(`LikmsNsmAdapter`)의 `scPpsUsr` 매핑도 이름 해석에 기대고 있었다.

## 사실

- likms 검색 엔드포인트는 **이름 파라미터를 보지 않는다**(최소 본문으로 보내면 무시되고,
  ID + `representKindCd`를 폼 필드 전체와 함께 보내야 걸린다 — 실측).
- 확정 값을 주는 것은 **후보 목록**이다: `/bi/popup/selSameNmMemb.do`가 의원 ID(`data-mem-id`)와
  대수·한자명·정당명을 그대로 제시한다(사이트가 사용자에게 보여주는 표). 판단은 사람 몫.
  → [2026-10-13-likms-represent-candidates](../findings/2026-10-13-likms-represent-candidates.md)
- 의안번호 → `billId`(`findBillDetail.do`)는 의안번호가 고유 키라 이 결정의 대상이 아니다.
  PAL/NSM의 `represent`·`scPpsUsr`는 각 사이트 서버가 이름을 직접 처리하므로 그대로 둔다.

## 결정

**이름을 ID로 자동 확정하는 경로를 제거하고, 확정 값(의원 ID·후보 목록)만 남긴다.**

- `ILikmsStateQuery.represent`(발의자명), `LikmsStateCrawler.resolveRepresentId()`,
  발의자명 해석 캐시, 검색 본문의 `represent` 파라미터,
  `Config.LIKMS_CHECK_SAME_NM_URL` 제거.
- 남는 것: `representId`(+ `representKindCd`, 기본 '전체') 직접 지정과
  `findRepresentCandidates(name, ageFrom?, ageTo?)`(사이트 원문 후보 조회).
  → 이름으로 좁히려면 후보에서 `membId`를 골라 넘긴다.
- `LikmsNsmAdapter`는 `scPpsUsr`가 오면 **예외**를 던진다. 조용히 무시하면 필터가 빠진
  전체 결과(오답)를 돌려주게 되므로, 지원하지 않는다는 사실을 드러낸다.
- 파괴적 변경이다(제거된 공개 API 사용 시 컴파일 오류) → 다음 릴리스는 **major**.

## 영향

- 테스트: `likms.test.ts`의 이름 해석 4건 제거(발의구분 기본값·`represent` 미전송 검사로 대체),
  `nsm-compat.test.ts`는 `scPpsUsr` 예외 2건 + 감사 1건으로 교체,
  라이브는 "이름 해석" 2건을 후보 기반 1건으로 합침.
- README: `represent` 문서 제거, "발의자 후보 조회" 섹션·어댑터 미지원 표기 갱신.
