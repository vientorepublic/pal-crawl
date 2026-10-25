# Project Architecture

- Kind: investigation
- Status: active
- Last verified: 2026-10-25
- Scope: single pal-crawl npm package
- Evidence: `package.json`, `tsconfig.json`, `src/index.ts`, `src/pal.ts`, `src/likms.ts`, `src/parser.ts`, `src/nsm-compat.ts`, `.npmignore`

## Package boundary

The root package is version 2.3.1 in the inspected release working tree. This is a local manifest observation, not confirmation of the current npm dist-tag. The compiler emits CommonJS / ES2020, declarations, and source maps from `src/` to `dist/`. `src/index.ts` defines the external export surface; `HttpClient` is internal.

There are no backend/frontend child repositories or composition-release pointers. CI uses Node.js 24. Runtime support must be established from actual dependencies and consumer contracts before changing it; CI's version alone is not a minimum-runtime declaration.

## Request and parsing flow

- `src/config.ts`: shared domains, endpoints, and request constants.
- `src/http-client.ts`: HTTP transport, retry/timeout behavior, and UTF-8/cp949/euc-kr decoding fallback.
- `src/pal.ts`: `PalCrawl` for PAL notices and `NsmLmSts` for NSM legislative status. `ScreenshotBase` manages optional browser screenshots; bulk APIs expose request pacing/concurrency.
- `src/likms.ts`: `LikmsCrawler` resolves bill identifiers and fetches proposal-reason fragments. `LikmsStateCrawler` provides state lists, filters, committee/candidate lookup, and detail requests.
- `src/parser.ts`: `PalParser`, `NsmLmStsParser`, `LikmsStateParser`, and `LikmsDetailParser` turn site HTML/response fragments into result interfaces.
- `src/nsm-compat.ts`: `LikmsNsmAdapter` implements `INsmListCrawler` and `INsmDetailCrawler`, mapping LIKMS results to the NSM-compatible surface. Similar interfaces do not prove identical site coverage or query semantics.

Network, parsing, optional hydration, and compatibility mapping have separate responsibilities. Review actual code and exported declarations before claiming a constructor-only migration is compatible.

## Contract and distribution boundaries

`scripts/drift-contracts/` declares selectors, endpoints, and result expectations. `scripts/check-site-drift.js` consumes these contracts; `drift:contracts` checks source/manifest alignment. Read the [contract documentation](../../scripts/drift-contracts/README.md) before site-contract changes.

`.npmignore` excludes `src/`, scripts, workflows, shared memory, coverage, `.freebuff/`, and compiled test files. Validate the actual tarball before publication; an exclusion file alone is not proof of payload contents.

## Historical investigations

The [legacy index](../INDEX.md) contains endpoint/filter measurements, compatibility limitations, and release observations from October 13–14. Those observations are not fresh live-site verification. Promote them individually only after rechecking relevant source or live evidence.
