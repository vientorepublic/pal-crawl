---
id: 2026-10-14-pr-contract-merge-gate
type: decision
title: 실사이트 계약 점검을 PR 필수 상태 체크로 묶어 드리프트 시 병합을 차단한다
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [ci, drift, branch-protection, convention]
supersedes: null
superseded_by: null
---

## 문제

드리프트 계약([2026-10-14-drift-contract-manifest](2026-10-14-drift-contract-manifest.md))과
24시간 정기 점검([2026-10-14-site-drift-daily-ci-check](../tasks/2026-10-14-site-drift-daily-ci-check.md))은
있었지만 **정기 실행뿐**이었다. 즉 사이트가 바뀐 사실은 다음 06:00 KST에야 드러나고,
그 사이에 병합된 PR은 낡은 계약을 통과시킨다. 계약 위반이 있어도 병합 자체는 막히지
않았다 — `main` 보호 규칙의 `required_status_checks`가 `null`이어서 통과 여부와 무관하게
병합 버튼이 눌렸다(병합 전 게이트는 사람이 로컬에서 돌리는 것에만 의존).

## 사실 (2026-10-14 실측)

- **적용 전 보호 규칙**: `required_status_checks: null`(필수 체크 0개), PR 필수가 켜져
  있었지만 승인 0명, `enforce_admins: false`, force push·삭제 금지.
- **체크 런 이름과 앱**: `test`·`build`·`contract-live`가 모두 `github-actions`
  (`app_id: 15368`). PR에 함께 붙는 `GitGuardian Security Checks`는 `gitguardian`(46505).
- **이름 충돌 실측**: `build.yml`의 잡 이름이 `test`였어서(이 PR에서 `build`로 rename)
  한 PR에 `test` 체크 런이 **2개** 붙었다. 필수 체크로 지정할 이름은 워크플로당 유일해야
  하며, 잡 id가 곧 context다.
- **`PUT /branches/main/protection`은 전체 교체**다. `required_status_checks`만 보내면
  PR 필수 설정이 사라질 수 있어 기존 값(`required_pull_request_reviews`, `allow_force_pushes`
  등)을 읽어 그대로 함께 보냈다. `checks: [{context, app_id}]`와 레거시 `contexts` 배열을
  둘 다 넣었고 API는 둘 다 보존한다. `required_signatures`는 이 본문에 없다(별도 엔드포인트).
- **검증 실험(네거티브)**: 실사이트에 없는 선택자를 단언하는 임시 계약을 넣은 PR을 만들어
  실패를 유도했다. 결과 — 오프라인 `drift:contracts`·`build`·`test` **통과**, `contract-live`
  **FAILURE**(점검 6건 중 드리프트 1, `Decide` 스텝이 `::error` + exit 1), 이 PR의
  `mergeStateStatus`는 **BLOCKED**. 같은 상태에서 녹색 PR(#92)은 `CLEAN`/`MERGEABLE`이라
  이름 불일치로 인한 오탐 차단은 없다.
- **함정**: `mergeStateStatus: BLOCKED`는 "필수 체크 실패"와 "필수 체크가 아직 보고되지
  않음"을 구분해 주지 않는다. 실험 1차 시도는 `dev`에서 파생한 브랜치로 했기 때문에
  워크플로 파일(`contract-live.yml`)이 없어 체크가 **누락**됐고, 그 BLOCKED를 실패 차단으로
  잘못 읽을 뻔했다. 게이트 차단을 실측할 때는 **게이트를 추가한 브랜치에서 파생**해야 한다.
- `workflow_dispatch`가 아니라 `pull_request` 트리거라서 이 게이트는 PR에서만 돈다.
  정기 점검(`site-drift.yml`)의 `schedule`은 기본 브랜치의 워크플로 파일만 실행한다.

## 결론/행동

- `.github/workflows/contract-live.yml` — PR→main에서 `dist`를 빌드해 실사이트 계약 18건을
  점검하고, 판정 스텝(`Decide`)이 상태 체크 이름이 된다. **드리프트(종료 코드 1)만 실패**로
  만들고, 확인 불가(2: 타임아웃·연결 실패)는 경고 후 통과시킨다 — 사이트 일시 장애로
  무관한 PR이 전부 막히는 것을 피한다. 알림(이슈·웹훅)은 하지 않는다: PR 화면과 Step
  Summary가 곧 알림이다.
- `main` 보호 규칙: 필수 상태 체크 `test`·`build`·`contract-live`(app 15368), `strict: true`
  (최신 `main` 기준 재검증 = Update branch 필요), `enforce_admins: false`(긴급 시 admin
  우회 가능). `GitGuardian Security Checks`는 외부 앱 의존이라 필수로 두지 않았다.
- 리포트 경로는 hidden 디렉터리를 쓰지 않는다 — `.drift/`는 `upload-artifact`가 기본
  제외해 조용히 빈 아티팩트가 된다([2026-10-14-drift-artifact-hidden-dir](../findings/2026-10-14-drift-artifact-hidden-dir.md)).
- 규칙으로 확정된 부분(필수 체크 3개·드리프트 시 병합 차단·확인 불가는 통과)은
  AGENTS.md "PR/병합 규칙" 3번으로 승격했다. 이 레코드는 배경과 실측만 남긴다.
