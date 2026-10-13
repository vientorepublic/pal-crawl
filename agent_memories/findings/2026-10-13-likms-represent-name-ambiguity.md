---
id: 2026-10-13-likms-represent-name-ambiguity
type: finding
title: likms 발의자명 해석은 대수 범위에 따라 동명이인으로 실패한다 — membId 자체가 대수를 한정
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, state-crawler, live-test, represent]
supersedes: null
superseded_by: 2026-10-13-likms-represent-candidates
---

## 문제

`LIKMS_LIVE_TEST=1 npx jest src/likms.live.test.ts`에서
`resolves a live 발의자명 to a member ID and filters by it`가 실패했다.

```
represent name is ambiguous: 주진우
  at LikmsStateCrawler.resolveRepresentId (src/likms.ts:494)
```

테스트가 1페이지의 **첫 번째** 발의자를 그대로 이름으로 쓴 것이 원인이었다.
`resolveRepresentId`는 `membCnt > 1`이면 예외를 던지는데, 목록의 발의자 표기를
대수 제한 없이(`ageFrom` 기본 `01`, `ageTo` 기본 `99`) 해석하면 동명이인이 걸린다.

## 사실

- 첫 페이지(mooring, 2026-10-13) 50건의 대표발의자 표기에서 뽑은 고유 이름 31개 중
  **6개가 대수 전체 범위(01–99)에서 `membCnt > 1`**이다:
  `주진우`, `김문수`, `조정훈`, `이수진`, `김영배`(동명이인),
  `박정하ㆍ송기헌`(`membCnt: 0`, 한 칸에 두 명). 나머지 25개는 유일하게 해석된다.
- `checkSameNm.do` 응답은 `{membCnt}` 또는 `{membId, membCnt}`뿐이고 **후보 목록이 없다**
  → 동명이인일 때 어느 의원인지 고를 근거가 서버에 없으므로 예외가 맞는 동작이다.
  범위를 좁히는 방법은 `ageFrom`/`ageTo`뿐이다.
  - `주진우`: `01–99` → `{"membCnt":2}`, `22–22` → `{"membId":"GJK57930","membCnt":1}`, `21–21` → `{"membCnt":0}`
- `membId`는 대수 인스턴스에 묶여 있어서 **ID 필터에 `ageFrom`/`ageTo`가 필요 없다**.
  실측(주진우): `representId=GJK57930&representKindCd=REPR` → 28건,
  같은 조건 + `ageFrom=22&ageTo=22` → 28건(동일). `representKindCd=전체` → 289건.
- 이름만 준 경로(`represent`, 대수 미지정)도 같은 ID로 해석되면 같은 결과를 준다
  (`주진우` 289 / `최혁진` 1,542 / `문진석` 1,206).

> 정정: "동명이인일 때 어느 의원인지 고를 근거가 서버에 없다"는 아래 판단은 틀렸다.
> 후보 목록을 주는 팝업 엔드포인트가 있다 → 2026-10-13-likms-represent-candidates.
> (라이브 테스트가 이름을 고정하지 않는다는 아래 결론은 그대로 유효하다.)

## 결론/행동

- 라이브 테스트는 1페이지의 첫 발의자명을 고정하지 않고, **대수 제한 없이 유일하게
  해석되는 이름이 나올 때까지 후보를 넘겨가며** 찾는다(동명이인 예외는 잡고 다음 후보로).
  확정된 `memberId`로 `REPR` 기준선을 만들 때 `ageFrom`/`ageTo`는 주지 않는다(ID가 대수를 한정).
- 크롤러 동작(`resolveRepresentId`의 동명이인 예외)은 의도된 계약이므로 바꾸지 않는다
  (단위 테스트 `src/likms.test.ts` "throws when the 발의자명 is ambiguous", README에 문서화).
- 이름만 주는 `search({ represent })`는 대수가 섞인 이름에서 예외가 날 수 있다 —
  사용자 코드에서 특정 의원을 노릴 때는 `ageFrom`/`ageTo`를 함께 주거나 `representId`를 쓸 것.
