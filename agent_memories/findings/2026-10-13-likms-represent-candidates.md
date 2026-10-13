---
id: 2026-10-13-likms-represent-candidates
type: finding
title: likms 동명이인 후보는 팝업 엔드포인트(/bi/popup/selSameNmMemb.do)에서 얻는다 — 대수·한자명·정당명 + membId
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, state-crawler, represent, endpoint]
supersedes: 2026-10-13-likms-represent-name-ambiguity
superseded_by: 2026-10-13-drop-likms-represent-name-resolution
---

## 문제

`checkSameNm.do`가 동명이인(`membCnt > 1`)만 알려주고 후보를 주지 않아, 어느 의원인지
고를 근거가 서버에 없다고 판단했다(→ 이전 레코드). 정말 없는지, 있다면 어디서 얻는지
사이트 JS와 실측으로 다시 확인했다.

## 사실

- 브라우저(`navigation.js` `checkSameMemb`, 1544–1549행)는 `membCnt > 1`일 때
  `Navigation.bill.popup.selSameNmMemb(params)`를 호출한다. 이 함수(1110–1120행)가 여는
  팝업이 **후보 목록을 그대로 담고 있다**.
  - URL: `GET /bill/bi/popup/selSameNmMemb.do?memName=&ageFrom=&ageTo=&classId=bill`
  - 표 컬럼: **대수 | 의원명 | 한자명 | 정당명**, 각 행의 `data-mem-id`가 `representId`에
    넣는 의원 ID(브라우저의 `setRepresntId()`가 그 값으로 `#representId`를 채우고 검색한다).
  - 응답 예(주진우, `01`–`99`): `22대 주진우 朱晋佑 국민의힘 GJK57930`,
    `16대 주진우 朱鎭旴 한나라당 IRT9826E` — `membCnt: 2`와 일치.
  - 1번째 셀은 모바일용 `ul.m_list`(이름/한자/정당)와 대수 `<span>`을 함께 담고, 데스크톱은
    2~4번째 셀을 쓴다. 표 머리는 `<thead>`에 `<th>`가 `tr` 없이 들어 있다.
- **같은 대수 안에도 동명이인이 있다**: `memName=이수진&ageFrom=21&ageTo=21` →
  `21대 이수진 李秀眞 무소속 D4L60530` / `21대 이수진 李壽珍 더불어민주당 0R68099X`.
  즉 대수를 좁히는 것만으로는 풀리지 않고, 정당·한자명이 단서다.
  (`22`–`22`는 1건 — 다른 이수진은 22대에 없다.)
- `김문수`는 22대 더불어민주당(86R9476S)과 17대 한나라당(RVR78866)이 **한자가 같다**(金文洙).
  한자만으로 동일인을 판정할 수는 없다(대수별 인스턴스로 취급해야 한다).
- 파라미터 특성(실측):
  - `ageFrom`/`ageTo`가 없으면 **400**(`checkSameNm.do`가 0을 주는 것과 다르다) → 항상 보낸다.
  - 후보 없음 → 200 + `조회된 데이터가 없습니다.` 한 행(데이터 행이 아님).
  - 쿠키 없이도 200 → CSRF·세션 불필요(GET).
- 두 출처의 ID는 일치한다(실측): `최혁진` → 팝업 `CC78321E` = `checkSameNm.do` `membId`,
  `문진석` → `4U29186R`(동일).

> 정정: 아래 구현 중 **자동 해석 경로(`resolveRepresentId`)는 제거됐다** — 이름을 ID로
> 확정하는 대신 후보 조회만 남긴다 → decisions/2026-10-13-drop-likms-represent-name-resolution.
> 엔드포인트·컬럼 실측과 후보 조회 구현은 그대로 유효하다.

## 결론/행동

- 파서: `LikmsStateParser.parseSameNameCandidates(html)` → `ILikmsRepresentCandidate[]`
  (`{ membId, name, age, hanja, party }`, 실패·빈 결과는 `[]`).
- 크롤러: `LikmsStateCrawler.findRepresentCandidates(name, ageFrom?, ageTo?)` —
  팝업 GET 1회(세션·CSRF 불필요), `ageFrom`/`ageTo` 기본 `01`/`99`. `src/index.ts`에
  `ILikmsRepresentCandidate` 등록, README에 사용 예시 추가.
- 동명이인 예외 메시지는 그대로 두되 안내를 붙였다(계약 유지):
  `represent name is ambiguous: <이름> — use findRepresentCandidates() to pick a membId`.
  자동 선택은 여전히 하지 않는다(어느 의원인지는 호출자가 정할 문제).
- 테스트: 유닛(`parseSameNameCandidates` 5건, `findRepresentCandidates` 4건) + 라이브 2건
  (모호한 이름을 목록에서 찾아 후보·필터 검증, 두 출처 ID 일치) + `verify-dist` 1건.
  `LikmsNsmAdapter`는 별도 메서드 없이 `adapter.likms.findRepresentCandidates()`로 노출된다.
- 이전 레코드는 "후보를 고를 근거가 서버에 없다"는 판단이 틀렸으므로 supersede로 정정한다
  (라이브 테스트가 이름을 고정하지 않는다는 결론은 그대로 유효).
