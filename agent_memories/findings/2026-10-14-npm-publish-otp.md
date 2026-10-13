---
id: 2026-10-14-npm-publish-otp
type: finding
title: npm 게시는 계정 2FA(OTP)를 요구한다 — 토큰 갱신만으로는 게시할 수 없다
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [npm, release, auth]
supersedes: null
---

## 문제

릴리스 절차의 마지막 단계인 `npm publish`가 에이전트의 비대화형 실행에서 완료되지 않는다.
어떤 조건에서 막히는지(인증 만료 vs 2FA)를 분리해 확인해야 다음 릴리스 계획을 세울 수 있다.

## 사실 (2026-10-14, 계정 `vientorepublic`)

- 1차 상태: `npm whoami` → **401**, `npm profile get`/`npm token list` → **E401
  "your authentication token seems to be invalid"**. `~/.npmrc`에 `//registry.npmjs.org/:_authToken`은
  있었으나 만료·폐기된 값이었다(레지스트리 읽기는 익명이라 `npm view`는 정상이었다).
- 토큰 갱신 후 `npm whoami` → `vientorepublic`(인증 자체는 정상). 그러나 `npm publish`는 **`EOTP`**:
  `This operation requires a one-time password.` + 브라우저 인증 URL 안내 후 exit 1.
- npm 경고도 같은 방향이다: *"npm tokens that bypass 2FA are being restricted for account changes and
  direct publishing"* — 즉 2FA 우회 게시 토큰은 더 이상 게시 경로가 아니다.
- 결과: 태그·GitHub 릴리스까지는 완료됐지만 registry 최신 게시본은 **2.2.1**로 남았고, 2.3.0은 미게시다.
- 인증 URL에는 `authId`가 들어 있어 로그·메모리에 남기지 않는다(자격증명 기록 금지 규칙).

## 결론/행동

- 릴리스 계획에는 **사람이 개입하는 게시 단계**를 항상 포함한다. 에이전트는 태그·릴리스·게이트까지
  준비하고, 게시는 아래 중 하나로 마무리한다.
  1. 대화형 터미널에서 `npm publish` 실행해 OTP 입력/브라우저 인증(가장 단순).
  2. `npm publish --otp=<code>` — 코드는 채팅이 아니라 사용자가 직접 실행 환경에서 다룬다.
  3. CI 게시: npm trusted publishing(OIDC) 또는 automation 토큰 시크릿 — 2FA 요구를 없애는 방향.
- 사전 점검은 `npm whoami`로 인증 유효성만 확인하고, 성공해도 게시 가능을 의미하지 않는다고 본다.
- 연관: `2026-10-14-release-v2.3.0`(릴리스 실행·버전 판단), `2026-10-14-npm-package-test-artifacts`(게시물 구성).
