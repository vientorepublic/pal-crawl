# Verification Notes

- Kind: investigation
- Status: active
- Last verified: 2026-10-25
- Scope: available validation commands and local compliance validation
- Evidence: `package.json`, Jest settings, `src/likms.live.test.ts`, `.github/workflows/`, `scripts/drift-contracts/README.md`

## Available checks

The root package defines `typecheck` (`tsc --noEmit`), `lint` (ESLint with `--fix`), `test` (Jest/ts-jest), `build` (`tsc`), and `format` (Prettier writes `src/**/*.ts`). Review mutation-producing checks before committing.

- Offline baseline: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run build`.
- Contract/tool checks: `npm run drift:self-test`, `npm run drift:contracts`.
- Built API check: `npm run verify:dist` after building.
- Live network checks: `npm run verify:dist:live`, `npm run drift:check`, and `LIKMS_LIVE_TEST=1 npm test -- --runInBand src/likms.live.test.ts`.
- Publication payload: `npm run release:dry`; publication lifecycle hooks may execute additional lint/test/build/clean steps. Read `package.json` before running it.

Default tests mock site requests; live tests require explicit opt-in. Real-site totals and titles can change and should not be fixed expectations. Live contract failure and inconclusive transport failure are distinct results. CI configuration is source evidence only; inspect actual runs before claiming success.

## Documentation validation limits

Instructions/memory-only changes use link/path review and `git diff --check` under AGENTS.md. They do not require package installation, version changes, or the package test/build suite. For this adoption task, actual outcomes are recorded in [the change record](../01-guidelines-and-memory/change.md). No package or live-site check result is implied by creating these notes.

## Compliance validation (2026-10-25)

The [compliance sweep](../02-guideline-compliance/change.md) passed typecheck, lint, the offline suite (245 passed, 11 live tests skipped), build, contract self-tests (12/12), source/manifest verification (44 selectors), and built API checks (17/17). Seven emitted declaration files matched original HEAD's public API after removing private members/comments. Both modified CLI failure paths passed isolated error-injection smoke checks.

Ordinary PAL/NSM request tests now use fixtures and HTTP mocks; a PAL-suite transport guard prevents accidental HTTPS calls. LIKMS live tests and built live verification remain opt-in. No live checks or fresh dependency installation were run in this local-only sweep.

## Historical findings

The archived retryCount-zero behavior was reproduced and fixed in `src/http-client.ts`: zero now makes one request, positive values keep the existing maximum-attempt interpretation, and invalid numeric counts fail before transport. Regression coverage is in `src/http-client.test.ts`. Do not treat the old activity-log observation as an outstanding defect.

The archive's npm OTP and tarball observations were not reverified. Inspect current source, registry, and environment before using them as present-tense facts.

## LIKMS committee coverage (2026-10-29)

The newest state-list page may contain only pre-referral bills with empty
`td.currCmt` cells. Do not require a positive committee coverage ratio.
`likms.listCoverage` instead requires one committee cell per parsed bill and
compares its text by bill ID; `likms/state-filters` verifies populated names on a
committee-filtered result. The parser itself needed no change. See the
[contract correction](../04-likms-committee-contract/change.md) for live evidence
and final validation. The four added offline cases distinguish legitimate blanks
from renamed cells and lost parsed values.

## Empty detail reasons (2026-10-31)

Bill 2222359 reproduces legitimate missing content on both sites: NSM renders an
empty pre under its reason header; LIKMS omits the entire reason section and its
list marks hasProposalReason false. Existing parsers correctly return null;
supplementary LIKMS pre.bill_memo text must remain separate. The detector now
requires nonempty NSM reason-cell text before asserting parsed content, and
conditionally requires LIKMS #prntSummary when advertised by its list or heading.
Lost populated content and renamed advertised selectors still fail. A populated
comparison bill (2222357) retained the existing LIKMS selector and parsed 483
characters. See [the investigation](../05-empty-detail-reasons/change.md).

The clean-install validation passed 247 Jest tests (11 opt-in live cases skipped),
30 checker self-tests, 44 source selectors, 17 built API checks, baseline
TypeScript/lint/build, and all 18 live contracts. Only root versions changed to
2.3.3; no dependency resolutions changed. This is local verification, not a remote
CI run or release.
