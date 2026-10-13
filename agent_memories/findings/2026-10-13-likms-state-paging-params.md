---
id: 2026-10-13-likms-state-paging-params
type: finding
title: likms 계류의안 목록은 rows로 페이지 크기 조절, 전체 페이지 수에 천 단위 쉼표
status: superseded
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, parser, pagination]
supersedes: null
# 본문의 "representKindCd/기간 필터가 단독으로 반영된다"는 관찰은 부정확했다.
superseded_by: 2026-10-13-likms-state-proposer-filter
---

## 문제

`LikmsNsmAdapter`(NsmLmSts 호환 어댑터)에서 NSM의 `pageSize`를 likms로 매핑하려다,
페이지 크기를 바꾸는 방법과 페이지 수 표기 형식을 실측으로 확정해야 했다.

## 사실

- 페이지 크기는 `rows` 파라미터로 조절한다(`rows=10`/`20`/`50`…). 미지정 시 기본 50건.
  실측: `rows=10` → 10건, `rows=20` → 20건.
  → 이전 기록(`2026-10-13-likms-state-csrf-not-enforced`)의 "페이지당 50건 고정" 표현은
  부정확하다(기본값이 50건일 뿐, `rows`로 조절 가능).
- `#pager_pages_text` 값은 페이지 수가 1,000을 넘으면 **천 단위 구분 쉼표**를 포함한다.
  예: `rows=10`일 때 `" (1/1,595 페이지)"`, 필터 적용 시 `" (1,483 ... )"`.
  정규식이 `[0-9]+`만 받으면 매칭에 실패해 `totalPages`가 0 → 폴백 1로 떨어졌다(파서 버그로 재현·수정).
  `#pager_count_text`(총 건수)도 `"15,947"`처럼 쉼표를 포함한다.
- 유효한 필터 파라미터: `billNm`, `billNo`, `representKindCd`(REPR/SING/COMM/전체),
  `proposerKind`(MEMASEMBY/GOV/CHRPR/CHRM/PRESIDENT/ETC/전체), `ageCmtId`, `ageFrom`/`ageTo`(제안대수),
  `billKind`(BKC_0001…), `listOrd`(billNo/billName/proposeDt), `ordCd`(ASC/DESC),
  `fromPropDt`/`toPropDt`, `rows`. 각 파라미터는 실제로 결과에 반영됨(실측).
- `stateId=mooring` 페이지에는 심사단계 탭(`stateDtlDivCd`)이 없어 `all` 고정이다.
  (billState.js의 `.state-tab-list`는 suggest/anbill 페이지 전용.)

## 결론/행동

- 파서는 페이지 수/총 건수의 쉼표를 제거한 뒤 정수로 변환해야 한다(`LikmsStateParser.parseList`,
  회귀 테스트 `parses totalPages that contain a thousands separator`).
- 어댑터는 `pageSize` → `rows`, `sgtCls`(900201/900202/900203) → `proposerKind`(GOV/MEMASEMBY/CHRPR)로 매핑한다.
- 페이지네이션 메타(총 건수·전체 페이지)는 항상 `rows`/필터가 반영된 응답에서 읽어야 한다.
