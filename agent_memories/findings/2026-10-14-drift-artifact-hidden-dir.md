---
id: 2026-10-14-drift-artifact-hidden-dir
type: finding
title: 드리프트 리포트 아티팩트가 업로드되지 않는다 — .drift/가 hidden 디렉터리라 upload-artifact 기본 설정이 제외한다
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [ci, drift, workflow]
supersedes: null
superseded_by: null
---

## 문제

정기 드리프트 점검이 남기는 상세 리포트(`.drift/report.md`·`report.json`)는 아티팩트
`site-drift-report`로 30일 보존된다는 전제였는데, main 병합 후 **첫 실제 실행에서 업로드가
건너뛰어졌다**(`##[warning] No files were found with the provided path: .drift/. No artifacts
will be uploaded.`). Step Summary는 정상이지만, 선택자 인벤토리 등 리포트 전체를 나중에
확인할 수단이 사라진다.

## 사실 (실행 38435134448, main, `workflow_dispatch`)

- 점검 스텝은 리포트를 실제로 썼다 — 로그에 `Markdown 리포트: .drift/report.md`,
  `JSON 리포트: .drift/report.json`, `결과: 계약 유지 ✅`.
- 같은 실행의 `Publish step summary`는 그 파일을 읽었다 — 스텝 스크립트의 **else 분기
  문자열(`리포트가 생성되지 않았습니다`)이 로그에 소스 에코 1회만 등장**(실행됐다면 2회)
  한다는 점으로 확인.
- 그런데 `Upload report artifact`는 같은 워크스페이스에서 파일을 찾지 못했다.
- 원인: `actions/upload-artifact`는 **hidden 파일을 기본 제외**한다 — v7 `action.yml`의
  `include-hidden-files` 기본값이 `'false'`이고, 두 리포트가 hidden 디렉터리 `.drift/`
  아래에 있다(로컬 `.gitignore`도 `.drift/`를 무시하므로 로컬에서도 보이지 않는다).
- 나머지 스텝은 전부 success: `Verify drift contracts against src` → `Build dist` →
  `Check live sites`(18/18 ok) → Step Summary → 알림. `Fail when drift is detected`는
  skipped(드리프트 0). 알림은 `resolved` 모드로 `닫을 드리프트 이슈가 없습니다` +
  웹훅 `HTTP 204`(저장소 시크릿 `DRIFT_WEBHOOK_URL`이 설정되어 있고 전송이 성공한다).
- `site-drift` 라벨 이슈는 없다(정상 실행은 이슈를 만들지 않는다).

## 결론/행동

- **경로를 보이는 디렉터리 `drift-report/`로 옮기는 쪽으로 고쳤다** (2026-10-14, PR에서).
  `include-hidden-files: true`보다 경로 이름에 의존하지 않아 upload-artifact 버전이
  바뀌어도 유지된다. 함께 바꾼 곳: 정기 워크플로의 점검·요약·업로드·알림 경로,
  `.gitignore`, `.npmignore`(배포물에 딸려 나가지 않게), 그리고 새 PR 점검
  워크플로(`contract-live.yml`)의 리포트 경로.
- 수정은 PR CI로 검증할 수 없다(정기 워크플로는 `workflow_dispatch`가 **기본 브랜치에
  워크플로 파일이 있어야** 동작한다 — 병합 전에 `gh workflow run`을 시도하면
  `HTTP 404: not found on the default branch`). 병합 후
  `gh workflow run site-drift.yml --ref main` → `gh run view <id> --json artifacts`로
  아티팩트가 실제 올라갔는지 확인한다.
