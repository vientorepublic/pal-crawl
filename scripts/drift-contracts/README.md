# 크롤러 계약 매니페스트

대상 사이트 3곳(PAL·NSM·LIKMS)과 교차 점검이 기대하는 **DOM 선택자·AJAX 엔드포인트·
검색 필터·파싱 결과 필드 형식**을 데이터로 선언한 곳이다. 실행기는
`scripts/check-site-drift.js`이고, 매일 06:00 KST `Contract check (daily)`와
PR마다 `Contract check (pull requests)`가 이 계약을 실사이트와 대조한다. 여기 파일은
`src/`의 파서·크롤러와 **같은 PR에서** 고친다.

| 파일 | 대상 |
|------|------|
| `pal.js` | 국회입법예고 — `PalCrawl` / `PalParser` |
| `nsm.js` | 국민참여입법센터 — `NsmLmSts` / `NsmLmStsParser` |
| `likms.js` | 국회 의안정보시스템 — `LikmsStateCrawler` / `LikmsCrawler` / `Likms*Parser` |
| `bridge.js` | 교차 확인 — PAL `contentId` → likms 제안이유 보정 경로 |
| `index.js` | 위 4개를 모아 실행기·검증기에 넘긴다 |
| `verify.js` | 매니페스트 ↔ `src/` 대조 검증(네트워크 불필요) |

## 왜 계약을 소스 밖에 두는가

파서는 프로젝트 규약상 **절대 예외를 던지지 않는다**(AGENTS.md). 사이트가 리뉴얼되면
크롤러는 조용히 빈 값·`null`을 돌려주고, 회귀는 사용자 코드의 데이터 결손으로만
드러난다. 그래서 "코드가 기대하는 계약"을 따로 적어 두고 실사이트와 매일 대조한다.

계약을 별도 데이터로 두면 **파서만 고치고 계약은 그대로 두는 일**이 생기므로,
`npm run drift:contracts`가 두 방향을 모두 강제한다.

1. **매니페스트 → 소스**: `usedBy`가 적힌 선택자·설정 상수·요청 파라미터가 그 소스
   파일에 실제로 있어야 한다. 파서에서 선택자를 바꾸면 계약도 같이 고쳐야 통과한다.
2. **소스 → 매니페스트**: `src/`의 페이지 특이 선택자(클래스·id·속성·의사 클래스)는
   모두 계약에 선언되어야 한다. 파서에 새 선택자를 추가하면 계약도 같이 적어야 한다.

## 점검 하나의 구조

```js
{
  id: 'pal/list-dom',            // 리포트·의존 관계에 쓰는 고유 id (사이트/이름)
  label: '목록 테이블·제목 앵커',   // 리포트에 그대로 나오는 한국어 설명
  kind: 'dom',                    // 'dom' | 'parse' | 'flow'
  endpoint: 'list',               // site.endpoints의 키(있다면)
  fetch: { op: 'pal.list', bind: 'palHtml' },   // 요청 후 컨텍스트에 바인딩
  dom: [{ selector, usedBy, live?, note? }],    // 선택자 계약
  fields: [{ path, filled|pattern|min|… }],     // 값 계약
  relations: [{ kind: 'ceilDivisor', … }],      // 값 사이의 관계식
  dependsOn: ['pal/list-dom'],    // 선행 점검이 실패하면 skipped
  summary: 'total={total} · items={items.length}',  // 리포트 한 줄(경로 치환)
  extra: 'pal.reasonConsistency', // 실행기의 부가 점검(교차 확인)
  inventory: { label: '섹션', selector: '.card-wrap .item h4' },  // 목록을 리포트에 남김
}
```

### kind

- **`dom`** — 요청한 응답에서 선택자가 살아 있는지 본다. `live: false`는 "선언만 하고
  실사이트에서는 단언하지 않는다"(복제 셀에서 제거하는 선택자, 조건부로만 나오는 요소,
  다른 흐름에서 확인하는 선택자)는 뜻이다. `usedBy`는 그 선택자를 쓰는 소스 파일이다.
- **`parse`** — `parse`가 있으면 `parse.from`(HTML 바인딩) 또는 방금 받은 응답을 파서에
  넘기고, 결과에 `fields`·`relations`를 적용한다. `parse`가 없으면 요청이 돌려준 객체를
  그대로 검사한다(예: `PalCrawl#search`).
- **`flow`** — 데이터만으로 표현할 수 없는 명령형 흐름. 실행기의 `FLOWS`에 있는 이름을
  쓴다(세션·CSRF를 거치는 AJAX, 여러 요청 비교, 교차 확인).

### 경로 (`path`)

컨텍스트 바인딩과 점검 결과를 합친 객체에서 해석한다. `items[0].billId`,
`committees[].comCd`(`[]`는 "모든 항목" — 항목이 없으면 통과), `items.length`,
`params.billId` 등을 쓴다.

### 값 계약

| 표기 | 뜻 |
|------|-----|
| `filled: true` | 비어 있지 않은 문자열 |
| `pattern: '^PRC_'` | 정규식 형식 |
| `min` | 숫자 하한(개수·총계 등) |
| `equals` / `oneOf` | 특정 값 |
| `equalsPath` / `notEqualsPath` | 다른 경로의 값과 같아야/달라야 |
| `lessThanPath` | 다른 경로의 값보다 작아야(필터가 반영됐는지) |
| `linkPrefix: 'DOMAIN'` | 링크가 `Config.DOMAIN` 기준인지 |
| `template` + `tokens` | 링크 형식. 토큰 값이 `Config.X`면 설정 상수를 쓴다 |
| `requireKeys` | 객체가 반드시 가져야 할 키(예: `#form` 숨김 필드) |
| `optional: true` | 값이 없으면 형식 검사를 건너뛴다(사이트가 안 주는 값) |

### 관계식 (`relations`)

- `{ kind: 'ceilDivisor', of: 'total', divisor: 50, target: 'totalPages' }` —
  `totalPages === ceil(total / 50)`
- `{ kind: 'pageSize', list: 'items', total: 'total', size: 50 }` —
  `items.length === min(50, total)`

### 필터 (`site.filters`)

사이트가 **코드로** 받는 검색 조건(예: `rslRsltNmL=900101`, `cmtResultCd=PRC_0000`,
`ageCmtId`). 하드코딩 대신 여기 적고 실행기가 읽는다. 값이 바뀌면 필터가 조용히
무시되거나 넓어지므로, 점검은 "결과가 실제로 좁아지는지"까지 본다.

### 엔드포인트 (`site.endpoints`)

`config`(설정 상수 이름)·`method`·`params`(요청 파라미터 이름)·`headers`를 적는다.
경로 문자열을 복사하지 않고 상수 이름을 참조하므로 `src/config.ts`가 단일 진실원이다.
검증기는 상수 이름이 `src/config.ts`에 있는지, 파라미터 이름이 `usedBy` 파일에 있는지
확인하고, 실행기는 배포 산출물의 `Config`에 그 상수가 있는지 확인한다.

## 계약을 고치는 절차

1. `src/`(파서·크롤러)를 고친다.
2. 같은 PR에서 해당 사이트 매니페스트를 고친다 — 선택자면 `dom`, 엔드포인트/파라미터면
   `endpoints`, 값 형식이면 `fields`.
3. `npm run drift:contracts`로 대조 통과를 확인한다(네트워크 불필요, PR CI에서도 돈다).
4. 실사이트 확인이 필요하면 `npm run build && npm run drift:check`
   (일부만: `npm run drift:check -- --sites likms`).
5. 사이트가 **실제로** 바뀐 것이면 `agent_memories/site-notes/`에 기록하고
   `src/*.test.ts` fixture를 실제 캡처로 갱신한다.

> 오탐(빈 값이 정상인 자리, 조건부로만 나오는 요소)을 계약에 넣으면 매일 알림이
> 소진된다. 새 계약은 실측으로 확인한 뒤 넣고, 애매하면 `live: false`나
> `optional: true`를 쓴다. 관련 배경: `agent_memories/site-notes/2026-10-14-drift-contract-empty-value-cases.md`.
