---
id: 2026-10-13-likms-state-csrf-not-enforced
type: finding
title: likms 계류의안 엔드포인트는 CSRF 토큰을 서버에서 검증하지 않음
status: active
author: buffy
created: 2026-10-13
updated: 2026-10-13
tags: [likms, csrf]
supersedes: 2026-10-13-likms-mooring-ajax-flow
superseded_by: null
---

## 문제

계류의안 수집 크롤러(`LikmsStateCrawler`)를 위한 옵트인 실제 네트워크 테스트를 작성하려고,
"CSRF 토큰이 없으면 서버가 401/403으로 거부한다"는 전제(이전 site-note의 표현: 헤더 필요)를
실측으로 확인했다.

## 사실

- `POST /bill/bi/bill/state/searchBillStatePaging.do`에 **위조 토큰**(`X-CSRF-TOKEN: BOGUS-TOKEN-0000`)이나
  **헤더를 아예 붙이지 않아도** HTTP 200과 함께 정상 목록(50건, 동일 응답 크기 117526B)을 반환한다.
  즉 이 엔드포인트는 현재 Spring Security CSRF를 **서버에서 검증하지 않는다**.
  (브라우저 JS는 `commonHelpUtil.js`의 axios 인터셉터에서 헤더를 항상 붙이지만, 서버 강제는 아님.)
- 세션 쿠키(`JSESSIONID`)는 여전히 함께 전송하며, `<meta name="_csrf">` 토큰은 페이지마다 받아온다.
- CSRF 토큰은 세션에 묶여 있어, `clearSession()` 후 페이지를 다시 받아도 같은 세션(같은 JSESSIONID)이면
  동일한 값이 재발급된다. 즉 "만료"는 세션 만료와 함께 일어난다.
- 페이지 경계(실측): `page=319`(마지막) → 50건, `page=320`(초과) → 0건 + `#pager_pages_text = " (320/1 페이지)"`.
  초과 페이지에서 `totalPages`가 1로 내려오므로, 페이지네이션 메타는 **1페이지 응답 값을 기준**으로 삼아야 한다.
- 페이지당 50건 고정, 총 15,947건 / 319페이지(2026-10-13 기준).

## 결론/행동

- 크롤러는 브라우저와 동일하게 GET(토큰·쿠키 확보) → POST(`X-CSRF-TOKEN`) 흐름을 유지한다.
  서버가 나중에 검증을 켜도 동작하도록 하는 방어이므로 제거하지 말 것.
- 자동 재발급·재시도는 **401·403(세션 거부)에서만** 1회 수행한다. 그 외 오류(네트워크 장애)는
  불필요한 추가 요청을 만들지 않도록 그대로 던진다 (`LikmsStateCrawler.isSessionRejection`).
- 토큰/세션 재발급은 `clearSession()`으로 명시적으로 트리거할 수 있고, 실제 네트워크 테스트
  `src/likms.live.test.ts`(`LIKMS_LIVE_TEST=1`)가 이를 검증한다.
- 이전 site-note(`2026-10-13-likms-mooring-ajax-flow`)의 AJAX 흐름 자체는 유효하지만
  "헤더 필요"라는 단정은 이 레코드로 정정한다.
