# Guideline Compliance Sweep

- Kind: investigation
- Status: resolved
- Created: 2026-10-25
- Last verified: 2026-10-25
- Scope: transport, parsers, crawler hydration, tests, operational scripts
- Change type: modification and behavior-preserving refactor
- Evidence baseline: local dev with prior guideline/memory changes and an unrelated notification-script edit

## Outcome and acceptance criteria

Inspect tracked source/configuration against current AGENTS.md and fix confirmed violations while preserving exported names, result shapes, endpoint contracts, and the existing user changes. Default tests must use fixtures, required transport errors must remain observable, optional hydration must preserve original data, and implicit hydration requests must be sequential. Remove unsafe production assertions and non-English test titles; retain untouched legacy comments under the explicit legacy allowance.

## Findings and plan

- `src/http-client.ts`: zero attempts can throw undefined; retry errors use an unchecked cast/non-null assertion; response stream errors/aborts are unhandled.
- `src/pal.test.ts`: multiple ordinary test groups contact real PAL/NSM sites and assume volatile totals/known IDs. Replace them with fixture-backed transport tests; keep live verification in existing opt-in tools.
- `src/pal.ts`: title hydration defaults to four concurrent requests; screenshot format is unnecessarily asserted.
- `src/likms.ts` and `src/parser.ts`: replace record assertions with property narrowing; keep parser failures safe and required network failures distinct.
- Test titles contain Korean prose; several test assertions cast away known result types unnecessarily.
- Operational async entry points have no explicit terminal rejection handling.

Implement failing transport/concurrency regressions before fixes, then verify typecheck, lint, tests, build, offline contract checks, and built API verification. Check public declarations for accidental changes. No publication is requested; do not commit, push, tag, or publish. Select/reconcile the release version and complete package-install gates before any later commit/publication.

## Implemented findings

- `HttpClient` preserves positive attempt limits, performs one attempt at zero, rejects invalid retry counts, and normalizes non-Error rejections without unchecked assertions. Rejected HTTP responses are drained, and response errors/aborts reject the request.
- PAL numeric fields now default malformed/non-finite values to zero and accept multiple thousands separators. LIKMS malformed page counters use numeric defaults; non-finite committee ordering becomes null.
- `LikmsCrawler.resolveBillId` parses only after awaiting the required request, so a transport SyntaxError is no longer incorrectly swallowed as malformed JSON. JSON object properties use runtime narrowing rather than record assertions.
- NSM optional title hydration is sequential and preserves original titles on failure. The unnecessary screenshot-format assertion was removed.
- PAL/NSM request tests use fixtures and private-client mocks, with a real-transport rejection guard. Removed fixed live IDs/totals and misleading placeholder browser-lifecycle checks; existing opt-in live verification remains available.
- All non-English test titles were translated. Result-shape checks retain known types instead of asserting records; the proposer-code test now uses the actual query union.
- Both operational async entry points explicitly report unexpected failures and set their respective failure exit codes.
- README documents retry semantics, sequential hydration, and the offline default suite. Untouched legacy comments remain allowed under AGENTS.md; no new Korean source comments were introduced.

## Verification

All commands ran from the repository root with Node.js v24.22.1 / npm 12.2.0 and the existing installed dependencies.

- Regression-first runs reproduced nine transport failures, four PAL parsing/concurrency failures, and a required transport SyntaxError incorrectly returning null. Those regressions pass after the fixes.
- Final `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, and `npm run build`: passed. Tests: 245 passed, 11 skipped (the opt-in LIKMS live suite), 256 total.
- `npm run drift:self-test`: 12/12 passed.
- `npm run drift:contracts`: passed, 18 checks and all 44 page-specific source selectors covered. No endpoint/selector contract changed.
- `npm run verify:dist`: 17/17 passed, without live requests.
- Original HEAD sources were built to an isolated temporary directory and compared with final emitted declarations using the TypeScript AST, excluding comments/private members: seven declaration files, zero public API changes.
- `node --check` passed for both modified CLI scripts. Isolated VM failure injection confirmed unexpected async failures are reported once with exit code 2 (contract checker) and 1 (dist verifier), without site requests.
- AST-based title inventory: zero remaining Korean test titles. Added-comment review: no Korean source comments added. `git diff --check`: passed.
- The initial lint run found an unused type import introduced during test replacement; it was removed. A subsequent test run exposed the namespace-import mock target's non-configurable property; the test now targets the actual HTTPS module through its default import. Final gates passed after both repairs.
- Live checks, clean installation, and version/commit/publication gates were not run. Dependencies/manifests did not change, and no commit/push/publication was requested. Reconcile the patch version and complete AGENTS.md's install/lock gates before a later package commit.

## Completion and handoff

Resolved locally. No exported names, public signatures, result shapes, site endpoints/selectors, package versions, workflows, or remote settings changed. Malformed transport/configuration handling and hydration scheduling were intentionally corrected as compatible maintenance. The pre-existing notification-script edit and prior instruction/memory changes remain untouched by this sweep. No commit, push, release, or npm publication was performed.

Historical retryCount-zero behavior is now reproduced and fixed; other historical OTP/tarball findings still require their own current verification. Future work should use the canonical verification note and current source rather than treating the old finding as an outstanding bug.
