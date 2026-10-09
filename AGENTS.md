# AGENTS.md

에이전트(및 신규 기여자)가 이 저장소에서 작업할 때 따라야 지침입니다.
규칙은 실제 코드와 Git 히스토리에서 도출했거나 여기서 확정한 것이며,
어긋나면 코드를 규칙에 맞출 것.

**목차**: [프로젝트 개요](#프로젝트-개요) · [저장소 구조](#저장소-구조) · [개발 명령어](#개발-명령어) ·
[TypeScript 컨벤션](#typescript-컨벤션) · [에이전트 메모리](#에이전트-메모리-agent_memories) ·
[테스트 컨벤션](#테스트-컨벤션) · [브랜치 전략](#브랜치-전략) · [커밋 메시지](#커밋-메시지) ·
[`gh` CLI](#github-리모트-작업은-gh-cli) · [PR/병합 규칙](#pr병합-규칙) · [릴리스](#릴리스) ·
[주의사항](#주의사항)

## 프로젝트 개요

- **pal-crawl**: npm에 배포되는 TypeScript **라이브러리** (Node.js CLI/서버 아님).
- 대상 사이트 3곳 크롤링:
  - 국회입법예고 `pal.assembly.go.kr` (PalCrawl / PalParser)
  - 국민참여입법센터 `opinion.lawmaking.go.kr` (NsmLmSts / NsmLmStsParser)
  - 국회 의안정보시스템 `likms.assembly.go.kr` (LikmsCrawler — 제안이유 보정용)
- 배포 산출물은 `dist/`만 (`.npmignore`가 `src/`·`agent_memories/` 제외).
  gitignore 대상은 빌드 산출물·커버리지뿐 아니라 OS/에디터 파일과 에이전트 상태 파일(`.freebuff/` 등)까지 포함한다 (`.gitignore` 참조).

## 저장소 구조

```
src/
  index.ts        # public API barrel — 모든 외부 노출 export는 여기에 등록
  config.ts       # Config enum: 도메인/URL/User-Agent 등 상수
  http-client.ts  # HttpClient: 인코딩(cp949/euc-kr 폴백), 재시도, 타임아웃
  parser.ts       # PalParser, NsmLmStsParser + 데이터 인터페이스 (HTML → 객체)
  pal.ts          # PalCrawl, NsmLmSts, ScreenshotBase + 설정 인터페이스
  likms.ts        # LikmsCrawler
  *.test.ts       # 테스트는 소스와 동봉 (별도 test/ 디렉터리 없음)
agent_memories/    # 에이전트 공유 메모리 (README.md = 형식 규칙, INDEX.md = 진입점)
.github/workflows/  # test.yml, build.yml (Node 24, PR → main에서 실행)
```

**설계 원칙**: 네트워크 담당(크롤러 클래스)과 HTML 파싱 담당(파서 클래스)을 분리한다.
새 사이트를 붙일 때도 `XxxCrawler`(요청) + `XxxParser`(파싱)로 나누고, 스크린샷은
`ScreenshotBase`를 상속해 공유한다.

## 개발 명령어

```bash
npm ci                # 설치 (lockfile 유지, npm install 금지)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint "src/**/*.ts" --fix  (--fix가 기본 포함)
npm run format        # prettier --write "src/**/*.ts"
npm test              # jest
npm run test:cov      # 커버리지
npm run build         # tsc → dist/
```

**커밋/PR 전 필수 게이트**: `npm run typecheck && npm run lint && npm test && npm run build`.
(`prepublishOnly`는 lint → test → build — `npm run build`(tsc)가 타입 오류에서 실패하므로 사실상 typecheck까지 포함된다.)

## TypeScript 컨벤션

### 툴체인

- 대상: CommonJS / ES2020, `declaration: true`, `rootDir: src` → `outDir: dist`.
- 포맷팅: Prettier — `singleQuote: true`, `trailingComma: "all"`, 2스페이스 들여쓰기, 80컬럼.
- Lint: flat config(`@eslint/js` recommended + `typescript-eslint` recommended).
  타입체크 기반 규칙은 없으므로 `npm run typecheck`가 사실상 타입 게이트.
- 아래 규칙 중 린트로 강제되지 않는 항목(타입 단언·비동기 관례·null 정책)이 있다.
  게이트 통과만으로 충분하지 않으므로 코드도 규칙을 따를 것.
- `npm run lint`는 `--fix`가 기본 — 실행 후 달라진 파일을 확인하고 커밋에 포함.

### 명명

- 파싱 결과/데이터 인터페이스는 **`I` 접두사**: `ITableData`, `IContentData`, `ISearchQuery`, `INsmBillDetail`.
- 클래스 설정/옵션 타입은 **접두사 없음**: `PalCrawlConfig`, `HttpClientConfig`, `LikmsCrawlerConfig`, `ScreenshotOptions`.
- 클래스는 PascalCase, 메서드/필드는 camelCase. 상수는 `Config` enum으로 모은다(파일마다 상수를 흩어놓지 않음).
- **파일명은 kebab-case**: `http-client.ts`, `likms.ts`. 테스트는 `원본이름.test.ts` (`likms.test.ts`).
- 메서드/함수는 동사 시작 + 역할 접미사로 짓는다:
  `get*`(요청), `parse*`(HTML → 객체), `build*`(URL·파라미터), `extract*`(특정 값 추출),
  `hydrate*`(보정), `normalize*`(정규화), `init*`(초기화).
- boolean은 의미가 드러나는 이름 (`enabled`, `fullPage`, `hydrateTruncatedTitles`).
  축약은 `id`, `url`, `html`, `pdf`, `hwp` 등 이미 관용인 것만 허용.

### 타입 시스템

- **`any` 금지** (ESLint `@typescript-eslint/no-explicit-any` 위반). 외부 입력은
  `unknown`으로 받고 가드로 좁힌다:
  ```ts
  // ❌ const parsed: any = JSON.parse(raw);
  // ✅
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('invalid payload');
  }
  ```
- **데이터 구조는 `interface`, 닫힌 집합·유틸리티는 `type`**:
  ```ts
  interface IContentData { /* ... */ }       // 구조 → interface
  type SortGbn = 'DESC' | 'ASC';             // 닫힌 집합 → type
  ```
  근거: `sortGbn?: 'DESC' | 'ASC'`, `format?: 'png' | 'jpeg'` 같은 기존 패턴.
- **공개 멤버·함수는 반환 타입을 항상 명시**:
  `public async getDetailPageHTML(billId: string): Promise<string>`.
- 제네릭 타입 매개변수는 `T` 접두사 (`TItem`, `TResult`). 추론 가능한 곳에
  불필요하게 제네릭·호출 위치 타입을 강제하지 않는다.
- 선택 옵션은 `?`로 선언하고 메서드 진입부에서 `?? 기본값`으로 정규화
  (LikmsCrawler/HttpClient 패턴):
  ```ts
  timeout: config?.timeout ?? 10000,
  ```
- 타입 단언(`as`)은 최소한만 — 검증 없이 타입을 확신시키는 단언 금지.
  예외: 테스트의 httpClient mock 캐스팅 (테스트 컨벤션 참고).
- 방어는 optional chaining과 병합 연산자로: `metaMatch?.[1]`, `contentType ?? ''`.

### 값·결측 처리

- 파싱 결측값은 **`undefined`가 아니라 `null`**: `string | null`, `number | null`.
- 설정 옵션 미지정은 `undefined`(선택 `?`)로 표현하고 `??`로 처리 —
  `null`과 `undefined`를 의미 없이 섞지 않는다.
- 원시 문자열을 그대로 반환하지 말고 필요한 정규화(`trim`, 공백 정리)를 거친다.

### 오류 처리

- 필수 인자는 메서드 진입부에서 가드:
  ```ts
  if (!normalized) throw new Error('billNo is required');
  ```
- **파서(`PalParser`, `NsmLmStsParser`)는 절대 예외를 던지지 않는다.**
  잘못된/빈 HTML이면 빈 배열·`null`·0으로 반환한다 (`returns [] for invalid html` 규약).
- 네트워크 오류·재시도·타임아웃은 `HttpClient`의 책임. 파서와 매핑 계층까지 전파하지 않는다.
- **선택적 보정(hydration) 로직은 절대 예외를 던지지 않는다.** 보정 실패 시 기존
  값을 유지하고 조용히 넘어감 (`catch { /* 기존 값 유지 */ }`). 사용자 데이터 손실 금지.
- catch 바인딩 값은 `unknown`으로 취급 — 가드 없이 사용하거나 무시하지 않는다.
  빈 catch는 위 hydration 규칙이 적용되는 선택적 보정에서만 허용.
- 오류 메시지는 영문 한 줄로 무엇이 잘못됐는지 설명 (`'billNo is required'`).
  원본 오류를 감쌀 때는 맥락과 원문을 함께 남긴다.

### 비동기 처리

- `async/await`만 사용, raw `.then()` 체이닝 금지.
- 모든 Promise는 `await`하거나 명시적으로 실패를 처리한다 —
  floating promise 금지 (이 규칙은 린트로 강제되지 않으므로 특히 주의).
- 독립적인 요청은 `Promise.all`로 병렬화, 일부 실패를 허용해야 하면
  `Promise.allSettled`.
- **외부 사이트 요청은 기본적으로 순서대로.** 폭주 방지는 `IBulkOptions`의
  `delayMs` / `concurrency`로 조절하고 서버에 부하를 주는 기본값을 만들지 않는다.

### 문서·주석 동기화

- `src/`에서 `console.*` 사용 금지 (테스트 파일 제외).
- JSDoc/주석은 **한국어**로 public API와 사이트 특이사항(숨김 폼, AJAX 엔드포인트 등)을 설명.
  이유: 대상 사이트가 국내 정부 시스템이라 도메인 맥락이 곧 문서.
  public 메서드는 1줄 한국어 요약 + 필요 시 `@param` / `@returns`.
- import는 `import type { ... }`로 타입만 필요한 경우 분리, 상대경로에 확장자 없음.
  Node 내장은 `'url'`, `'https'` 형태로 임포트.
- **새 public API는 반드시 `src/index.ts`에 export 등록** (누출 방지),
  같은 PR에서 README.md의 메서드·타입 문서도 갱신한다.

## 에이전트 메모리 (`agent_memories/`)

여러 에이전트/세션이 **동일한 기억**을 읽고 쓰기 위한 공유 기록소.
형식의 단일 진실원은 `agent_memories/README.md`이며, 요약은 다음과 같다.

- **진입점**: `agent_memories/INDEX.md` — 작업 시작 시 먼저 확인.
- **유형별 폴더**: `decisions/`(결정과 이유), `tasks/`(작업 이력),
  `site-notes/`(대상 사이트 DOM·엔드포인트 변화), `findings/`(버그·원인 분석).
- **레코드 형식**: 파일당 1주제, 파일명 `YYYY-MM-DD-<영문-kebab-slug>.md`, YAML frontmatter 필수
  (`id`, `type`, `title`, `status`, `author`, `created`, `updated`, `tags`).
- **append-only**: 기존 레코드 본문을 고치지 않는다. 내용이 바뀌면 새 레코드를 만들고
  `supersedes`로 연결한 뒤 이전 레코드는 `status: superseded`로 표시.
- **쓰기 후 반드시 `INDEX.md` 갱신** (같은 작업 안에서).
- 기록 대상: 커밋하기 어려운 결정과 근거, 사이트 구조 변화, 재현된 버그 원인,
  되풀이되는 작업의 체크포인트. 매사 기록하지 말고 후속 에이전트가 물어볼 내용만.
- **중복 금지**: 규칙으로 확정된 사항은 AGENTS.md로 승격하고 메모리에는 배경·근거만 남긴다.
- **충돌 시 우선순위**: 지침(AGENTS.md)과 메모리 내용이 충돌하면 **AGENTS.md가 우선**한다 —
  메모리는 규칙이 아니라 사실·배경 기록이다. 메모리가 사실이 바뀌어 정정되면
  supersede 방식(새 레코드 + `supersedes` 연결)으로 갱신한다.
- 비밀·토큰·개인정보 기록 금지. git에 커밋해 공유하고, npm 게시는 제외(`.npmignore`).

## 테스트 컨벤션

- 위치: `src/<파일명>.test.ts` (소스 옆). `testMatch: **/*.test.ts`, ts-jest.
- 구조: `describe('클래스명')` → `describe('메서드명')` → `test('동작 설명', ...)`.
- 테스트 이름은 **영문**, 동사 시작, 동작 기술 (`returns [] for invalid html`).
- HTML fixture는 테스트 파일 상단에 템플릿 리터럴 상수로 인라인하고
  `// ─── 섹션명 ───` 주석으로 구분한다. (실제 캡처를 축약한 형태)
- 네트워크는 절대 호출하지 않는다. httpClient 주입 후 캐스팅해 mock:
  ```ts
  const httpClient = (instance as unknown as {
    httpClient: { get: (url: URL) => Promise<string> };
  }).httpClient;
  jest.spyOn(httpClient, 'get').mockImplementation(async () => FIXTURE_HTML);
  ```
- 파서 변경 시 관련 fixture 테스트를 먼저 깨뜨려 회귀를 잡을 것 (대상 사이트 DOM 변경에 매우 민감).

## 브랜치 전략

| 브랜치 | 역할 |
|--------|------|
| `dev` | **로컬 작업 공간의 기본 시작점·복귀지.** 피처 브랜치 파생 기준. Renovate의 `baseBranches` |
| `main` | 공식 브랜치 (origin HEAD). **피처 병합 대상.** CI는 **PR → main**에서만 트리거됨 |
| `renovate/*` | Renovate 자동 생성 (`renovate/<scope>-<version>`, 예: `renovate/typescript-6.x`) |

**로컬 작업 라이프사이클** (`dev`가 기본 시작점):

1. **시작**: `git switch dev && git pull` — 작업은 항상 최신 `dev`에서 시작한다.
2. **파생**: `git switch -c feat/<요약>` — 피처 브랜치는 `dev`에서 파생한다.
3. **병합**: 작업 완료 후 PR로 **`main`에 병합**한다 (CI가 PR→main 전용이므로 병합 대상도 main).
   `gh pr create --base main` → `gh pr merge <n> --merge`.
4. **복귀·동기화**: `main` 병합이 끝나면 **`dev`로 복귀해 동기화**하고 다음 작업을 시작한다:

   ```bash
   git switch dev && git pull
   git merge main --no-edit   # main에 병합된 내용을 dev에 반영
   git push origin dev        # 리모트 dev도 같은 상태로 유지
   ```

- 기능/수정 브랜치 명명은 Conventional Commits 타입을 따름:
  `feat/<요약>`, `fix/<요약>`, `chore/<요약>` (예: `feat/hydrate-likms-reason`).
  요약은 영문 kebab-case.
- `pull.rebase = false` — 히스토리는 rebase가 아니라 **merge**로 유지.

## 커밋 메시지

Conventional Commits, 영문 주제문:

```
feat: Hydrate empty proposalReason from 국회 의안정보시스템 (likms)
fix: Preserve line breaks in proposalReason
chore(deps): update all dependencies to latest compatible versions
refactor: Use typed httpClient for mocking in NsmLmSts tests
```

- 사용 타입: `feat`, `fix`, `chore`, `chore(deps)`, `refactor`, `docs`, `test`, `build`.
- 소콜론 뒤는 대문자 시작. 한국어 도메인 용어(의안정보시스템 등)는 그대로 허용.
- 버전 커밋(`2.2.0` 형식의 bare version)은 `npm version`이 자동 생성 — 직접 작성하지 않음.
- **커밋 서명**: Git에 PGP(GPG) 서명키가 설정되어 있으면 **커밋을 서명한다**.
  - 설정 여부 확인: `git config --get commit.gpgsign` / `git config --get user.signingkey`
    (서명키가 있는데 `commit.gpgsign`이 꺼져 있으면 `git commit -S`로 서명하거나
    `git config commit.gpgsign true`로 기본값으로 활성화)
  - 서명키가 없는 환경에서는 서명 없이 커밋해도 된다 — 키 생성을 강제하지 않는다.
  - `npm version`이 만드는 버전 커밋도 같은 설정을 따라 자동 서명된다.

## GitHub 리모트 작업은 `gh` CLI

에이전트가 작업하든 커맨드라인에서 작업하든, GitHub 리모트 관련 작업은
반드시 **GitHub CLI(`gh`)** 를 사용한다. 웹 UI 수작업이나 `git` 명령만으로
우회하지 않는 것을 원칙으로 함.

```bash
gh auth status                 # 인증 상태 확인 (실패 시 안내부터)
gh pr create --base main       # PR 생성 (피처 병합 대상은 main)
gh pr view 123                 # PR 조회 (상태/체크/리뷰)
gh pr checks --watch           # CI 결과 확인
gh pr merge 123 --merge        # merge commit으로 병합 (squash 금지, 아래 규칙)
gh pr list / gh issue list     # 목록 조회
gh api ...                      # 없는 API는 gh api로 직접 호출
```

- `gh`가 없거나 미인증이면 작업을 멈추고 사용자에게 설치/인증을 안내할 것
  (자동 로그인 시도나 토큰 입력 요청 금지).
- 리모트 푸시·PR·이슈·릴리스 등 모든 원격 조작은 `gh` + `git` 조합으로 수행.

## PR/병합 규칙

1. **병합 방식은 merge commit** (squash 금지). 제목은 GitHub 기본 형식을 따른다:
   `Merge pull request #N from vientorepublic/<branch>`.
2. PR 전 게이트를 로컬에서 통과시키고 올린다:
   `npm run typecheck && npm run lint && npm test && npm run build`.
   ⚠️ CI workflow는 `pull_request: branches: [main]` 전용 — main 대상 PR은 CI가 도우며
   **dev 대상 PR(현재 사실상 Renovate)은 CI가 돌지 않는다.** 어느 쪽이든 로컬 게이트는
   병합 전 필수이고, dev 대상 PR에서는 로컬 검증이 유일한 방어선이므로 생략 금지.
3. PR 본문에 변경 유형(feat/fix/…)과 영향받는 사이트/파서를 명시.
4. Renovate PR: 자동 브랜치이며 베이스는 `dev` (renovate.json 설정 — 피처는 main이 대상이어도 Renovate만 dev는 유지).
   병합 후 dev 동기화 루틴에서 함께 최신화하며, 의존성 업데이트는 Renovate에 맡긴다 —
   수동으로 `package.json`을 올리지 않는 것을 원칙으로 함 (잠금파일 함께 커밋).
5. 하나의 PR은 하나의 목적. 파서 로직 변경과 리팩터링/포맷팅을 섞지 않는다.

## 릴리스

### 배포 지시 절차

사용자가 **배포**를 지시하면 아래 순서를 따른다. 각 단계의 성공을 확인한 뒤 다음 단계로 진행한다.

1. **버전 분석 후 버전 범프** — 직전 태그 이후의 변경으로 major/minor/patch를 판단한다:

   ```bash
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```

   - `fix:` / `chore:`만 있으면 **patch**, `feat:` (하위 호환 유지)는 **minor**,
     공개 API 제거·시그니처 변경 등 기존 사용자 코드가 깨지는 변경은 **major**.
   - 판단 근거(어떤 타입의 커밋이 포함됐는지)를 PR 본문에 남긴다.
   - `npm version <major|minor|patch>`로 범프 — `package.json` 버전 커밋(예: `2.3.0`)과
     태그(`v2.3.0`)가 기존 패턴대로 자동 생성된다. 버전을 직접 편집해 태그를 별도로 만드는 방식은 쓰지 않는다.
   - 브랜치는 `dev`에서 파생한 `chore/release-v2.3.0` 형태 (브랜치 전략의 라이프사이클).
2. **lockfile 동기화** — `npm install`을 1회 실행해 `package-lock.json`이 새 버전과
   일치하는지 확정하고 함께 커밋한다. (`npm version`이 이미 동기화했다면 차이 없음.)
   ※ 개발 명령어의 "`npm install` 금지"는 **설치** 목적 규칙이고, 여기는 lockfile **갱신** 목적이므로 예외다.
3. **PR 생성 (`gh`)**

   ```bash
   git push -u origin chore/release-v2.3.0
   gh pr create --base main --title "chore: Release v2.3.0" --body "..."
   ```

   - PR 본문에 버전 판단 근거와 변경 요약을 포함한다 (PR/병합 규칙 3번 참조).
4. **최종 검토 후 병합** — 아래를 전부 통과하고 문제가 없으면 병합한다:
   - 로컬 게이트: **PR/병합 규칙 2번과 동일** — `npm run typecheck && npm run lint && npm test && npm run build`
   - 형식: `npm run format` 실행 후 달라진 파일을 커밋에 포함
   - GitHub CI/Checks: `gh pr checks --watch` 로 Test/Build 워크플로 성공 확인
   - PR diff 최종 리뷰 (버전·lockfile 외에 불필요한 변경이 섞이지 않았는지)
   - 문제가 있으면 병합하지 말고 수정한 뒤 이 단계를 다시 돈다.

   ```bash
   gh pr merge <n> --merge   # merge commit, squash 금지
   ```

5. **릴리스 생성** — 기존 GitHub 릴리즈 패턴과 일관된 구조로 만든다
   (태그 `vX.Y.Z`, 제목 `release: vX.Y.Z`, 자동 노트):

   ```bash
   git switch main && git pull
   git push origin --follow-tags                             # 버전 태그 푸시
   gh release create vX.Y.Z --title "release: vX.Y.Z" --generate-notes
   npm publish                                               # 게시 (prepublishOnly: lint → test → build)
   ```

   - `--generate-notes`가 기존처럼 `**Full Changelog**: .../compare/vA...vB` 비교 링크를 포함한다.
   - 릴리스·게시가 끝나면 **`dev`로 복귀해 동기화**한다 (라이프사이클 4단계).

### 기존 릴리스 스크립트 (같은 게이트 사용)

```bash
npm run release:patch   # npm version patch && npm publish
npm run release:minor
npm run release:major
```

- `prepack`이 clean → build를, `prepublishOnly`가 lint → test → build를 자동 실행.
- 게시 전 `npm run release:dry`로 내용물 확인.
- 다만 사용자가 배포를 지시한 경우에는 위 **배포 지시 절차**를 우선한다.

## 주의사항

- `http-client.ts`의 인코딩 폴백(UTF-8 선언 ↔ cp949 실제 응답) 로직은 사이트별
  예외 대응이므로 임의로 제거하지 말 것.
- Puppeteer 스크린샷은 선택 기능 (`screenshot` 설정). 기본 경로는 HTTP + cheerio 파싱이며
  스크린샷 때문에 무거운 브라우저 의존을 기본 경로에 도입하지 말 것.
- `.DS_Store` 등 로컬 파일과 에이전트 상태 파일(`.freebuff/` 등)은 커밋하지 않음 — `.gitignore` 패턴이 관리한다.
