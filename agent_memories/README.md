# agent_memories — 에이전트 공유 메모리

여러 에이전트/세션이 **동일한 기억**을 읽고 쓰기 위한 공유 기록소입니다.
이 파일이 형식과 규칙의 **단일 진실원(single source of truth)**입니다.
에이전트는 이 폴더에서 작업할 때 이 규칙을 따른다.

## 읽기 규칙 (작업 시작 시)

1. `INDEX.md`를 먼저 읽는다 — 전체 레코드 목록과 최신 상태가 들어 있다.
2. 관련 레코드가 있으면 본문을 읽고 근거(명령어 출력, 커밋 해시, 파일 경로)까지 확인한다.
3. 같은 주제의 레코드가 여러 개면 `status: active`인 것과 `supersedes` 연결을 따라 최신본을 추적한다.
4. **충돌 시 우선순위**: 규칙 내용은 `AGENTS.md`가, 기록 형식은 이 README가 단일 진실원이다.
   레코드는 사실·배경 기록이므로 규칙(AGENTS.md)을 뒤집지 않는다 — 사실이 바뀌었으면
   supersede 방식으로 정정한다.

## 쓰기 규칙 (의미 있는 사건이 있을 때)

1. `_templates/memory.md`를 복사해 새 파일을 만든다 (직접 작성해도 형식만 지키면 된다).
2. 파일명: `YYYY-MM-DD-<영문-kebab-slug>.md` (예: `2026-10-09-likms-ajax-flow.md`).
   - 날짜는 기록일(로컬). slug는 영문 kebab-case로 검색성 확보, 제목(`title`)은 한국어.
   - 같은 날 같은 주제가 또 생기면 `...-2.md` 접미사.
3. frontmatter를 채운다 — 아래 "레코드 형식" 참조. `type` 값은 반드시 상위 폴더명과 같아야 한다.
4. 본문은 **완결된 한 주제**만 담는다. 후속 에이전트가 맥락 없이 읽어도 이해 가능하도록
   문제 → 사실 → 결론/행동 순서로 쓰고, 근거를 남긴다.
5. 저장 후 **`INDEX.md`에 행을 추가**한다 (같은 작업 안에서 필수).
6. 커밋 시 메모리 변경을 함께 커밋한다 (공유가 목적).

## 갱신·버전 관리 (append-only)

- 기존 레코드 본문은 **고치지 않는다** (오타·깨진 링크 수정만 허용).
- 내용이 사실상 바뀌면 **새 레코드**를 만들고 frontmatter에 `supersedes: <이전 id>`를 적는다.
  동시에 이전 레코드의 `status`를 `superseded`로, `superseded_by`를 새 id로 바꾼다.
  (이때만 기존 파일의 frontmatter 2줄을 수정한다.)
- 삭제하지 않는다. 폐기는 `status: superseded`로 표시하는 것으로 충분하다.
- 여러 에이전트 동시 작업 충돌 완화: 레코드는 항상 **파일 1개 = 주제 1개**로 만들고,
  `INDEX.md` 병합 충돌이 나면 표를 깨지 말고 행을 합쳐 재정렬한다.

## 디렉터리 구조

```
agent_memories/
  README.md            # 이 문서 — 형식·규칙의 단일 진실원
  INDEX.md             # 전체 레코드 목록 (진입점)
  _templates/
    memory.md          # 새 레코드 템플릿
  decisions/           # type: decision — 한 번 내린 결정과 이유 (ADR 성격)
  tasks/               # type: task     — 작업 이력·체크포인트 (재개 지점)
  site-notes/          # type: site-note — 대상 사이트 DOM/엔드포인트/인코딩 변화 관찰
  findings/            # type: finding  — 버그·성능 등 원인 분석 결과
```

- `type` 필드값 = 상위 폴더명. 폴더와 어긋나는 레코드를 만들지 않는다.
- `agent_memories/`는 git에 커밋해 공유하고(`.gitignore` 아님), npm 게시는 제외(`.npmignore`).

## 레코드 형식 (frontmatter)

```yaml
---
id: 2026-10-09-likms-ajax-flow     # 파일명과 동일 (.md 제외) — 고유해야 함
type: site-note                     # decision | task | site-note | finding
title: likms 심사정보 탭은 AJAX POST로 채워짐
status: active                      # active | superseded
author: buffy                        # 기록한 에이전트/사람 식별자
created: 2026-10-09
updated: 2026-10-09                 # 본문 내용이 바뀐 날짜
tags: [likms, parser]
supersedes: null                    # 이전 레코드 id (없으면 null/생략)
superseded_by: null                 # 갱신한 새 레코드 id (없으면 null/생략)
---
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `id` | ✅ | 파일명과 동일한 고유 식별자 |
| `type` | ✅ | `decision` / `task` / `site-note` / `finding` — 반드시 폴더명과 일치 |
| `title` | ✅ | 한국어 한 줄 요약 |
| `status` | ✅ | `active`(기본) 또는 `superseded` |
| `author` | ✅ | 기록 주체 (`buffy`, `사용자명` 등) |
| `created` / `updated` | ✅ | `YYYY-MM-DD` |
| `tags` | ✅ | 소문자 배열 — 모듈/사이트/주제 (`pal`, `likms`, `test`, `ci`) |
| `supersedes` / `superseded_by` | ⬜ | 레코드 간 갱신 관계 연결 |

본문은 자유 형식이지만 **문제 → 사실 → 결론/행동** 순서를 권장한다.

## 기록 대상 vs 비대상

| 기록한다 ✅ | 기록하지 않는다 ❌ |
|---|---|
| 사이트 DOM/엔드포인트 변화 (site-note) | 코드로 이미 표현된 규칙 (→ AGENTS.md) |
| 릴리스·아키텍처 결정과 대안 (decision) | 커밋 메시지에 이미 있는 변경 요약 |
| 재현된 버그의 원인과 근거 (finding) | 일회성·유산성 없는 중간 사고 |
| 긴 작업의 진행 체크포인트 (task) | 비밀·토큰·개인정보·자격증명 |
| 다음 에이전트가 반복 질문할 맥락 | 에이전트 자기 자랑·추측만 있는 기록 |

## INDEX.md 작성법

- 표 한 행: `| id | type | title | status | updated |`
- `updated` 내림차순 정렬. 파일 경로는 `decisions/2026-10-09-...md` 형태로 상대경로 링크.
- 추가·갱신은 기존 표를 유지한 채 행만 삽입/수정한다.

## 예시 레코드

```markdown
---
id: 2026-10-09-encoding-fallback-trap
type: finding
title: UTF-8 선언 페이지가 실제로는 cp949로 응답함
status: active
author: buffy
created: 2026-10-09
updated: 2026-10-09
tags: [http-client, encoding]
---

## 문제
`pal.assembly.go.kr` 일부 페이지는 `<meta charset="utf-8">`를 선언하지만 본문은 cp949.

## 사실
- `decodeBody`는 치환 문자(U+FFFD) 발생 시 cp949 → euc-kr 순으로 재디코딩.
- euc-kr 복원 점수가 더 높으면 그쪽을 채택.

## 결론/행동
이 폴백 로직은 사이트별 예외 대응이므로 제거 금지. 관련 패치는 회귀 테스트부터 만들 것.
```
