# Empty detail reasons in newly received bills

- Kind: plan
- Status: resolved
- Created: 2026-10-31
- Last verified: 2026-10-31
- Scope: NSM and LIKMS detail contracts and parser regression fixtures
- Change type: modification
- Evidence baseline: clean dev at aa91975, equal to origin/dev; feat/detail-reason-contract
- Related: https://github.com/vientorepublic/pal-crawl/actions/runs/41127853457

## Outcome and acceptance criteria

Accept genuinely absent proposal reasons without hiding lost populated values or
renamed LIKMS reason selectors. Preserve public parser results, request semantics,
transport, and adapter behavior. Verify empty and populated live responses,
meaningful offline regression fixtures, all package checks, and all 18 live
contracts. The follow-up request authorizes signed commits, feature-to-dev and
dev-to-main merge PRs, GitHub Release v2.3.3, and a post-merge live workflow
dispatch. npm publication is explicitly excluded.

## Contracts and consumers

The referenced run has 16 successful checks and two false drift reports. Both
failures concern the newest bill 2222359 (LIKMS ID
PRC_28C5662B6BFC4229A3F4DAAFBA1562). Fresh sequential requests reproduced:

- NSM detail has the reason header and an empty `<pre></pre>`, with no attachments.
  `NsmLmStsParser.parseDetail` correctly returns null. The detector incorrectly
  equated the presence of any pre element with a nonempty reason body.
- LIKMS list advertises `hasProposalReason: false`; its detail fragment has receipt
  information but no reason section or `#prntSummary`. A separate `pre.bill_memo`
  contains supplementary notes and must not become the proposal reason.
- Bill 2222357 (PRC_ECE07F5DB5F343059B4AAA475885AE) advertises a reason and still
  serves `#prntSummary` with 483 parsed characters. The existing parser works.

These observations establish optional content, not a site-wide markup migration.
The original parsers need no behavior change. Public declarations, README API,
exports, and NSM compatibility mapping remain unchanged. Reserve patch 2.3.3
against dev and latest tag 2.3.2 for contract maintenance and regression tests.
Raw live captures remain ignored under drift-report/.

## Implementation plan

1. Make NSM consistency depend on nonempty reason-cell text, scoped by its header.
   Ignore unrelated pre elements and accept empty or whitespace-only pre content.
2. Make LIKMS reason DOM conditional. Still require the selector when the list
   advertises a reason or the fragment has a reason heading; reject lost parsed
   values when the source body or list link exists.
3. Add captured reduced structures to parser tests and 14 detector self-test
   scenarios. Derive aggregate self-test counts from declared expectations: the
   previous fixed totals predated even the committee cases.
4. Keep manifest explanations aligned; use the normal installation and package
   validation gates. No parser runtime changes or new selectors are necessary.

## Verification

- Initial focused parser suites: 190 tests passed.
- Detector regressions: 30/30 self-test assertions passed after correcting the
  whitespace fixture and stale aggregate expectations.
- Initial source/manifest validation: 44 selectors passed.
- Node 24.22.1 / npm 12.2.0: `npm i --userconfig /dev/null` and
  `npm ci --userconfig /dev/null` succeeded with existing exact-version script
  approvals. Only root package/lock versions changed; no dependency resolutions.
  SHA-256 stayed e4c5b8d8cf0f7d0a98e968301c7af315cd53627450d4b5c993ed107320318dad.
  npm reported 33 existing audit findings (4 low, 26 moderate, 2 high, 1 critical);
  dependency remediation is outside this contract correction.
- Final clean-install checks passed: typecheck, lint, Jest (247 passed, 11 opt-in
  live tests skipped), build, drift:self-test (30/30), drift:contracts (44 source
  selectors), verify:dist (17/17), and git diff --check. Lint added no changes.
- Full live `npm run drift:check -- --json drift-report/empty-detail-reasons.json
  --markdown drift-report/empty-detail-reasons.md`: 18/18 passed, zero drift,
  inconclusive, or skipped. Both newly received detail checks accepted null;
  PAL-to-LIKMS hydration still returned 413 characters.
- Separate opt-in LIKMS Jest and verify:dist:live suites were not run; the complete
  contract pass plus targeted live empty/populated comparisons covers this scope.
  No workflow dispatch or publication checks were run.

- Release dry run passed: 24 expected files (21 runtime dist files, README,
  LICENSE, package.json); lifecycle lint/test/build/prepack passed. This was a
  dry run only and did not publish to npm.

## Completion and handoff

Implemented and verified locally on feat/detail-reason-contract. Canonical
verification notes and the memory index link this finding. Release preflight
confirmed authenticated GitHub access, equal dev/main/feature baselines at
aa91975, unused v2.3.3, and no unrelated integrated work. Main requires test,
build, and contract-live checks with a current branch and zero required approvals;
dev has no classic branch protection. Existing Renovate PRs are outside scope.

Authorized release sequence: signed fix commit and push, merge feature PR into
dev, merge dev PR into main after required checks, verify final main tree and
package version, tag that exact commit, create GitHub Release with generated
notes, dispatch site-drift.yml on main, inspect the complete live report, then
synchronize dev by ancestry-preserving update and clean up only the merged feature
branch. npm publication is intentionally excluded. Final immutable references
and workflow results will be reported in the completion response and release
notes.
