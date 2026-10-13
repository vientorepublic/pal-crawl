---
id: 2026-10-13-likms-live-test-derive-values
type: task
title: likms 라이브 테스트 전수 점검 — 실시간 값 고정 가정 제거(건수·의안명·페이지 수는 응답에서 유도)
status: active
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, live-test, convention]
supersedes: null
superseded_by: null
---

## 문제

`src/likms.live.test.ts`가 실시간 데이터 값을 고정 가정해, 사이트 데이터가 바뀌면 코드
회귀가 아닌 실패가 난다. 첫 사례는 발의자명을 1페이지 첫 건으로 고정한 것
(→ [2026-10-13-likms-represent-name-ambiguity](../findings/2026-10-13-likms-represent-name-ambiguity.md)).
같은 부류가 더 있는지 전수 점검하고 고쳤다.

## 사실 (2026-10-13 실측)

- **페이지 수는 건수에서 유도된다.** `totalPages === ceil(total / rows)`가 무필터
  (15,950 → 319), 22대(`ageFrom/ageTo=22`, 15,226 → 305), 의안명 필터(167 → 4)에서
  모두 성립. 즉 이 관계식은 `rows` 기본값(50)을 검증하는 단언으로 쓸 수 있다
  (고정 건수 `toHaveLength(50)`을 대체).
- **의안명 하드코딩(`billNm: '국가재정법'`)은 조용히 썩는다.** 해당 이름이 목록에서
  사라지면 `filtered.total > 0`이 실패한다. 22대 1페이지 첫 건의 `billName`으로
  필터하면 total 1, 같은 `billNo`가 나온다. 목록의 `billName`에는 발의자 표기까지
  들어 있다(`…법률안(주진우의원 등 10인)`). `billNm`은 부분일치다(`'이재명 대'` → 3건).
- **초과 페이지는 응답 메타가 비어 있다.** `pageIndex = totalPages + 1` 응답은
  `items: []`뿐 아니라 `total: 0`, `totalPages: 1`로 파싱된다(`#pager_count_text` 없음).
  따라서 "초과 페이지인지"를 응답만으로 판정할 수 없고, 경계 검사는
  *초과 페이지가 채워졌다면 목록이 실제로 커진 경우에만 허용*으로 바꿨다
  (채워졌는데 `total`이 그대로면 페이지 계산 버그 → 실패).
- **`hasProposalReason` ⇒ 보정 성공.** 1페이지 flagged 49건 전부 제안이유가 채워졌고
  (35.0초, 20자 이하 0건) 실패 건이 없어, 3건 엄격 검사(누락 없이 채워짐)는 근거가 있다.
- `getAllPages` 1·2페이지 사이 `billNo` 중복 0건 — 페이지 경계는 겹치지 않는다.

## 결론/행동

- 라이브 테스트 규약을 파일 헤더에 명시: **의안명·발의자명·건수·페이지 수를 고정값으로
  박지 않고 같은 실행의 응답에서 유도한다.**
  - 페이지 크기·페이지 수 → `items === min(50, total)`, `totalPages === ceil(total/50)`
  - 의안명 → 22대 1페이지 첫 건의 `billName`(같은 `billNo`가 결과에 있는지까지 확인)
  - 발의자명 → 대수 제한 없이 유일하게 해석되는 후보(위 finding)
  - 경계 → 초과 페이지 허용 조건(`total` 증가)으로 대체, `getAllPages`는 1페이지 응답에서
    페이지 크기를 유도
- 실행 시간이 목록 크기에 비례하는 검사(페이지 수·경계)는 목록이 작아지면 의미가 달라지므로,
  단언은 "고정값"이 아니라 "관계"로 유지한다.
- 검증: 라이브 스위트 8/8 통과(2회), 오프라인 게이트(`typecheck`·`lint`·`test` 229건·`build`)와
  `verify:dist` 14/14 통과.
