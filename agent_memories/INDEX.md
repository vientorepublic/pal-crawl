# agent_memories INDEX

에이전트 메모리 진입점. **작업 시작 시 이 파일을 먼저 읽고**, 레코드를 추가/갱신한 뒤에는
이 표를 함께 갱신한다. 형식 규칙은 [README.md](./README.md)가 단일 진실원이다.

## 전체 레코드

| id | type | title | status | updated |
|----|------|-------|--------|---------|
| [2026-10-14-inconclusive-retry](decisions/2026-10-14-inconclusive-retry.md) | decision | 확인 불가(타임아웃)는 지연 후 1회 재점검하고 판정 우선순위로 병합한다(드리프트는 가려지지 않음) | active | 2026-10-14 |
| [2026-10-14-contract-verification-wording](decisions/2026-10-14-contract-verification-wording.md) | decision | 사람에게 보이는 이름을 "사이트 드리프트"에서 "크롤러 계약 검증"으로 통일하고 내부 식별자는 유지한다 | active | 2026-10-14 |
| [2026-10-14-pr-contract-merge-gate](decisions/2026-10-14-pr-contract-merge-gate.md) | decision | PR마다 실사이트 계약을 점검해 main 필수 상태 체크로 묶고, 드리프트 시 병합을 차단한다 | active | 2026-10-14 |
| [2026-10-14-drift-artifact-hidden-dir](findings/2026-10-14-drift-artifact-hidden-dir.md) | finding | 드리프트 리포트 아티팩트가 업로드되지 않는다 — .drift/가 hidden이라 upload-artifact 기본 설정이 제외(→ drift-report/로 경로 이전) | active | 2026-10-14 |
| [2026-10-14-drift-contract-manifest](decisions/2026-10-14-drift-contract-manifest.md) | decision | 드리프트 계약을 선언적 매니페스트로 분리하고 src 대조로 강제한다(`drift:contracts`) | active | 2026-10-14 |
| [2026-10-14-likms-state-list-field-emptiness](site-notes/2026-10-14-likms-state-list-field-emptiness.md) | site-note | likms 계류의안 1페이지 필드별 값 존재율 — 소관위는 회부 전이면 빈 값이 정상 | active | 2026-10-14 |
| [2026-10-14-site-drift-daily-ci-check](tasks/2026-10-14-site-drift-daily-ci-check.md) | task | 사이트 드리프트 24시간 점검 CI 추가 — PAL·NSM·LIKMS의 DOM·AJAX 계약을 실사이트와 대조 | active | 2026-10-14 |
| [2026-10-14-drift-contract-empty-value-cases](site-notes/2026-10-14-drift-contract-empty-value-cases.md) | site-note | 빈 값이 정상인 자리 실측 — 드리프트 점검 초기 오탐 4건(NSM 빈 셀·PAL 빈 제안이유·likms 비숫자 코드·문서 없는 건) | active | 2026-10-14 |
| [2026-10-13-likms-committee-code-endpoint](findings/2026-10-13-likms-committee-code-endpoint.md) | finding | likms 소관위 코드는 /bi/bill/sch/findAgeCmt.do JSON에서 얻는다 — 이름→코드 해석과 처리결과·공동발의 필터 | active | 2026-10-13 |
| [2026-10-13-nsm-likms-migration-review](tasks/2026-10-13-nsm-likms-migration-review.md) | task | NsmLmSts → Likms 최종 구조 점검 — "생성자만 교체"가 성립하는 범위와 남은 문제 4개 | superseded | 2026-10-13 |
| [2026-10-13-drop-likms-represent-name-resolution](decisions/2026-10-13-drop-likms-represent-name-resolution.md) | decision | likms 제안자명 자동 해석 제거 — 확정 값을 주지 못하는 이름 기반 경로는 남기지 않는다 | active | 2026-10-13 |
| [2026-10-13-likms-represent-candidates](findings/2026-10-13-likms-represent-candidates.md) | finding | likms 동명이인 후보는 팝업 엔드포인트(/bi/popup/selSameNmMemb.do)에서 얻는다 — 대수·한자명·정당명 + membId | superseded | 2026-10-13 |
| [2026-10-13-likms-live-test-derive-values](tasks/2026-10-13-likms-live-test-derive-values.md) | task | likms 라이브 테스트 전수 점검 — 실시간 값 고정 가정 제거(건수·의안명·페이지 수는 응답에서 유도) | active | 2026-10-13 |
| [2026-10-13-likms-represent-name-ambiguity](findings/2026-10-13-likms-represent-name-ambiguity.md) | finding | likms 발의자명 해석은 대수 범위에 따라 동명이인으로 실패한다 — membId 자체가 대수를 한정 | superseded | 2026-10-13 |
| [2026-10-13-likms-pending-scan](tasks/2026-10-13-likms-pending-scan.md) | task | likms 접수(발의 상태) 스캔 대안 + 상세 조회 포트 — 현행 요약 | superseded | 2026-10-13 |
| [2026-10-13-likms-srng-prgrs-stts-cd-filter](findings/2026-10-13-likms-srng-prgrs-stts-cd-filter.md) | finding | likms 심사진행상태 필터(srngPrgrsSttsCd)는 조건이지만 쓸 수 있는 코드값을 알 수 없다 | active | 2026-10-13 |
| [2026-10-13-nsm-compat-detail-port](tasks/2026-10-13-nsm-compat-detail-port.md) | task | LikmsNsmAdapter 상세 조회 포트(INsmDetailCrawler) 추가 — 교체 가능 범위 확대 | superseded | 2026-10-13 |
| [2026-10-13-nsm-compat-audit](tasks/2026-10-13-nsm-compat-audit.md) | task | NsmLmSts → 계류의안(LikmsNsmAdapter) 교체 호환성 감사 결과 | superseded | 2026-10-13 |
| [2026-10-13-likms-state-proposer-filter](findings/2026-10-13-likms-state-proposer-filter.md) | finding | likms 계류의안 검색 파라미터 — rows/ordCd/기간은 단독 적용, 발의자 필터는 폼 전체+ID+발의구분 필요 | superseded | 2026-10-13 |
| [2026-10-13-likms-state-paging-params](findings/2026-10-13-likms-state-paging-params.md) | finding | likms 계류의안 목록은 rows로 페이지 크기 조절, 전체 페이지 수에 천 단위 쉼표 | superseded | 2026-10-13 |
| [2026-10-13-likms-state-csrf-not-enforced](findings/2026-10-13-likms-state-csrf-not-enforced.md) | finding | likms 계류의안 엔드포인트는 CSRF 토큰을 서버에서 검증하지 않음 | active | 2026-10-13 |
| [2026-10-13-likms-mooring-ajax-flow](site-notes/2026-10-13-likms-mooring-ajax-flow.md) | site-note | likms 계류의안 목록은 CSRF 헤더가 필요한 AJAX POST로 채워짐 | superseded | 2026-10-13 |

<!-- 표 작성법
- updated 내림차순 정렬
- 행: | <id> | <type> | <title> | <status> | <updated> |
- id는 상대경로 링크: [2026-10-09-slug](site-notes/2026-10-09-slug.md)
- type = 상위 폴더명 (decision | task | site-note | finding)
-->

## 최근 활동

- 2026-10-14: **일시 장애 재점검 도입** — 계약 위반 없이 확인 불가(타임아웃)가 남으면 검증기가 지연 후 1회(기본 15초, `--retry`/`--retry-delay`) 확인 불가가 난 사이트를 다시 점검하고, 판정 우선순위(`drift` > `ok` > `error` > `skipped`)로 병합한다 — 일시 장애는 회복되지만 **드리프트는 재점검 성공으로 가려지지 않는다**. 드리프트가 이미 있으면 재점검하지 않는다(실패가 확정인데 사이트 부하만 늘리므로). 기록은 리포트의 `retry`·점검별 `retried`/`previousStatus`에 남고 콘솔·Markdown·이슈 본문·웹훅이 보여준다. `--self-test`에 회복·잔여 확인 불가·드리프트 보존·렌더링 검증을 추가(12/12). 실측 중 별개 결함도 확인: `HttpClient`는 `retryCount: 0`이면 `undefined`를 던진다(`src/http-client.ts:243`).
- 2026-10-14: **용어 통일 — "사이트 드리프트" → "크롤러 계약 검증"** — 워크플로 이름(`Contract check (pull requests)` / `Contract check (daily)`), 콘솔 배너·요약, Markdown 리포트, 이슈 제목·라벨(`crawler-contract`), 웹훅 제목, 아티팩트명(`contract-check-report`)을 계약 관점으로 바꿔 "무엇을 확인하는지"가 제목만 봐도 읽히게 했다. 상태 라벨도 `드리프트 감지` → `계약 위반`, `정상` → `계약 유지`. 파일명·npm 스크립트(`drift:*`)·`DRIFT_*` 환경변수·JSON 상태 값은 기계 계약이라 그대로 두었다(이유는 decision 레코드에).
- 2026-10-14: **PR 시점 계약 검증 + main 필수 상태 체크로 병합 차단** — `contract-live.yml`(PR→main에서 실사이트 계약을 확인, 드리프트만 실패로 처리하고 확인 불가는 경고 후 통과)을 추가하고, 리포트 경로를 `.drift/`에서 `drift-report/`로 옮겨 아티팩트 업로드 결함을 함께 고쳤다. Build 워크플로 job id를 `build`로 바꿔 상태 체크 이름(`test`/`build`/`contract-live`)이 겹치지 않게 했다. 보호 규칙에는 필수 체크 3개(app 15368)와 `strict: true`를 걸었고, 네거티브 실측으로 확인: 실사이트에 없는 선택자를 단언한 임시 PR에서 `contract-live`만 FAILURE → `mergeStateStatus=BLOCKED`(녹색 PR은 `CLEAN`). `BLOCKED`는 체크 누락과 실패를 구분하지 않아 실측은 게이트를 추가한 브랜치에서 파생해야 했다.
- 2026-10-14: **PR #91 병합 + 정기 드리프트 파이프라인 첫 실물 실행** — merge commit `f7c0b00`, `dev` 동기화(`dev`=`origin/dev`=`main`=`origin/main`). main에서 `workflow_dispatch`로 정기 점검이 스텝 전부 success(계약 검증·빌드·실사이트 18/18 ok·알림), 드리프트 0이라 실패 스텝은 skipped. 알림은 `resolved` 모드로 이슈를 건드리지 않았고 웹훅은 HTTP 204. 다만 리포트 아티팩트는 업로드되지 않았다(hidden 디렉터리 `.drift/` → `include-hidden-files` 기본 false) — 원인 분석은 finding 레코드에.
- 2026-10-14: **드리프트 계약을 선언적 매니페스트로 분리** — 점검 항목(선택자·엔드포인트·필터·필드 형식·관계식)을 `scripts/drift-contracts/`의 사이트별 데이터로 옮기고, `scripts/check-site-drift.js`는 `kind: dom|parse|flow`를 실행하는 실행기로 정리했다. `npm run drift:contracts`가 **매니페스트 → 소스**(`usedBy` 문자열 실재)와 **소스 → 매니페스트**(페이지 특이 선택자 44개 전부 선언)를 대조하므로 파서 변경과 계약 변경이 같은 PR에 묶인다(네거티브 실측으로 양방향 확인). 실사이트 18/18 ok 유지, 리포트 형식·알림 스크립트 계약 불변. 리팩터링 중 실측으로 오탐 2건을 걷어냈다(다중 경로 `items[].x`는 항목이 없으면 통과, likms 목록 `committee`는 회부 전 빈 값이 정상).
- 2026-10-14: **사이트 드리프트 24시간 점검 CI 추가** — `scripts/check-site-drift.js`가 `dist`의 공개 API로 실사이트 3곳을 호출해 파서가 의존하는 선택자·엔드포인트·응답 필드 18항목을 대조하고, `.github/workflows/site-drift.yml`이 매일 06:00 KST에 돌려 드리프트면 `site-drift` 이슈(+선택 웹훅)로 알린다. 판정은 `drift`(사이트 변경)와 `error`(확인 불가)를 분리해 일시 장애로 알림이 소진되지 않게 했다. 첫 실행 오탐 4건(빈 셀·빈 제안이유·비숫자 위원회 코드·문서 없는 건)은 계약을 실측에 맞추며 해소(오프라인 self-test + 네거티브 실측으로 검출기 검증).
- 2026-10-13: **상임위 이름 → likms 코드 해석 구현** — 계류의안 페이지의 소관위 select는 옵션이 '전체' 하나뿐이라 JS가 AJAX로 채우는 `GET /bill/bi/bill/sch/findAgeCmt.do`(=`ageCmtList`, `/bill` 컨텍스트 필수)를 찾아 `findCommittees`로 노출. 어댑터가 `scCptPpostCmt`(이름)를 `ageCmtId`(코드)로 해석하고(대수 범위 캐시, 꼬리표·공백 무시), 미해석·동명이면 요청 전 예외. `cmtResultCd`(PRC_0000 계류/0011 폐기/0013 가결/0014 부결)·`jntPrpslYn`도 노출. 실측: 전체 15,950 / 법사위 1,618 / 계류 15,547 / 공동발의 Y 163+N 15,787. 점검 기록의 남은 문제 2번을 해소하며 그 레코드를 supersede.
- 2026-10-13: **NsmLmSts → Likms 최종 구조 점검** — "생성자만 교체"는 목록 5개 + 상세 3개 + 네트워크 설정까지 성립한다. 남은 문제 4개(무시되는 필터가 조용히 전체 결과를 주는 문제, `scCptPpostCmt`→`ageCmtId` 매핑 부재, pending `maxPages` 상한, 스크린샷 대응 없음)와 실측 차이(기본 페이지 20↔50건, `pageSize`는 양쪽 다 임의 값 반영 — 문서의 '정해진 집합' 표기 정정, 총계 21,336↔15,950, 제안일자 NSM `YYYYMMDD` vs likms 양쪽 필수, `hydrateProposalReason` 비용)를 실측치와 함께 기록. pending-scan 레코드를 supersede.
- 2026-10-13: NSM 제안일자 필터 실측 — `YYYYMMDD`여야 정상 동작(`20260901` 888건, `~20260910` 346건), 하이픈 형식은 시작일만 줄 때 5,903건으로 범위가 어긋나고 양쪽을 주면 0건. README·`INsmSearchQuery` JSDoc에 명시(정규화는 미적용 — 기존 호출부 결과가 바뀌는 변경).
- 2026-10-13: 결정 — likms 제안자명 자동 해석(`represent`·`resolveRepresentId`)과 어댑터 `scPpsUsr` 매핑을 제거하고, 확정 값인 `representId` + 후보 조회(`findRepresentCandidates`)만 남긴다(어댑터는 예외로 알림, major 파괴 변경). 관련 finding 2건을 supersede.
- 2026-10-13: 동명이인 후보 실측 — 사이트 JS가 여는 팝업(`/bi/popup/selSameNmMemb.do`)이 대수·한자명·정당명 + `membId` 목록을 준다(같은 대수 중복도 있음). `parseSameNameCandidates`/`findRepresentCandidates`로 구현하고, "후보 근거가 없다"던 이전 finding을 supersede로 정정.
- 2026-10-13: 라이브 테스트 전수 점검 — 건수·의안명·페이지 수 고정 가정을 응답에서 유도하는 방식으로 교체(`totalPages === ceil(total/50)` 관계식, 의안명 샘플링, 초과 페이지 허용 조건). 실측 근거는 task 레코드에.
- 2026-10-13: 라이브 테스트 `resolves a live 발의자명` 실패 원인 실측 — 1페이지 대표발의자 이름 31개 중 6개가 대수 전체 범위에서 동명이인이라 이름을 고정할 수 없다. 테스트를 후보 순회 방식으로 교체하고, `membId`가 대수를 한정한다는 사실을 finding으로 기록.
- 2026-10-13: likms 심사진행상태 서버 필터 실측 — `srngPrgrsSttsCd`는 존재하나 유효 코드값을 얻을 수 없어(사이트가 옵션 목록을 렌더하지 않음) 스캔 대안(`searchPending`/`getAllPendingPages`, `progressStatus === '접수'`)을 구현. 상세 포트 task를 pending-scan 레코드로 대체(supersede).
- 2026-10-13: 상세 조회 포트(`INsmDetailCrawler`) 추가 — 의안번호→billId 해석(`findBillDetail.do`, `/bill` 컨텍스트 필요), `LikmsDetailParser`(상세 페이지 + 심사정보 조각), `td.doc` 의안원문 URL 파싱. 감사 task를 detail-port 레코드로 대체(supersede).
- 2026-10-13: likms 계류의안 AJAX/CSRF 흐름 관찰 기록 (`LikmsStateCrawler` 구현 근거) → 실측 결과 CSRF 미검증을 finding으로 정정(supersede).
- 2026-10-13: `LikmsStateCrawler` 옵트인 실제 네트워크 통합 테스트(`src/likms.live.test.ts`, `LIKMS_LIVE_TEST=1`) 추가.
- 2026-10-13: `LikmsNsmAdapter` + `INsmListCrawler` 포트 추가(NsmLmSts 호환 교체), `rows`/`proposerKind` 파라미터와 페이지 수 쉼표 파서 수정.
- 2026-10-13: 발의자 필터 실측 — 검색 본문을 페이지 폼 숨김 필드 기반으로 바꾸고 `checkSameNm.do` 이름→ID 해석 추가(`resolveRepresentId`). paging-params finding을 위 finding으로 대체(supersede).
- 2026-10-13: `NsmLmSts` → `LikmsNsmAdapter` 교체 호환성 감사(포트 동일 코드 실행 비교 + 컴파일 타임 검증) → 결과와 호출부 체크리스트를 task 레코드로 기록.
