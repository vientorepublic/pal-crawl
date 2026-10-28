# LIKMS committee contract false positive

- Kind: plan
- Status: active
- Created: 2026-10-29
- Last verified: 2026-10-29
- Scope: LIKMS live contract checker and manifest
- Change type: modification
- Evidence baseline: clean dev at f16dd16, equal to origin/dev; branch feat/likms-committee-contract
- Related: https://github.com/vientorepublic/pal-crawl/actions/runs/40768417673

## Outcome and acceptance criteria

Correct the false drift report for an entirely unassigned newest page. Accept
source-empty committee cells, reject missing/renamed cells and lost parsed values,
and complete the downstream filter/detail/candidate checks on the live site.
Do not change crawler request semantics, parser results, public exports, or CI
failure/retry policy. The follow-up request authorizes project-standard GitHub
integration/release and a main-branch workflow dispatch; npm publication is
explicitly excluded.

## Contracts and consumers

The failed run reported 14 passed, one drift, and three dependent skips.
`likms/state-list-dom` passed, but `EXTRAS[likms.listCoverage]` required at least
one nonempty committee among the first 50 rows. On 2026-10-29, a fresh request
returned 50 genuine empty `td.currCmt.mnone` cells (total 16290); first bill
2222226 had status receipt. A committee-filtered request for code 9700006
returned 50 populated cells, all correctly parsed as the target committee
(total 1634). These totals are observations, not fixed assertions.

`LikmsStateParser.parseList` already preserves empty values correctly. The checker
now compares each parsed committee by bill ID to its source cell and requires
one cell per parsed bill. The existing `likms/state-filters` contract independently
checks populated committee names after selecting a committee code. The manifest
records that all newest bills may be pre-referral. Four offline regression cases
cover all-empty pages, populated pages, lost values, and renamed cells.

Public declarations and adapters remain unchanged. This is compatible package
maintenance; reserve patch 2.3.2 (dev and latest tag are 2.3.1).

## Verification

- Initial checker self-test after the fix: 16/16 passed.
- Live evidence: default and committee-filtered list requests completed sequentially.
- Node 24.22.1 / npm 12.2.0: npm i and npm ci succeeded using
  --userconfig /dev/null, retaining existing exact-version script approvals.
  SHA-256 lockfile verification passed; only root versions changed to 2.3.2,
  with no dependency resolution changes. npm reported nine existing audit
  findings; dependency maintenance is outside this correction.
- Final clean-install checks passed: typecheck, lint, Jest (245 passed,
  11 opt-in live tests skipped), build, verify:dist (17/17), drift:self-test
  (16/16), drift:contracts (44 source selectors), and git diff --check.
- Final full live command: npm run drift:check -- --json
  drift-report/committee-fix.json --markdown drift-report/committee-fix.md.
  All 18 checks passed, zero drift/inconclusive/skipped. The previously failing
  list accepted source coverage 0/50; committee filters, details, candidates,
  and PAL-to-LIKMS hydration all completed successfully.
- Reports remain ignored local artifacts. No additional live test suite or
  verify:dist:live run was needed after the complete contract pass.

- Release preflight reran all offline gates successfully. release:dry passed
  with 24 expected files (21 dist runtime files, package.json, README, LICENSE).
  The initial sandbox run could not write npm cache; the normal-permission retry
  completed successfully without changing cache ownership or disabling checks.

## Completion and handoff

Implemented and verified locally on feat/likms-committee-contract. Changes include
checker, LIKMS manifest, package/lock patch version, this record, memory index,
and the canonical verification note. Lint introduced no source changes.
The follow-up release gate verified authenticated GitHub access, fresh equal
feature/dev/main baselines, unused v2.3.2, and no unrelated integrated changes.
Main requires test/build/contract-live with an up-to-date branch and zero required
approvals; dev currently has no classic branch protection. Preserve signing and
merge history. Open Renovate PRs are excluded.

Release plan: sign and push the verified fix, merge feature into dev by PR,
merge dev into main after required CI, verify/tag final main, create GitHub
Release v2.3.2, dispatch site-drift.yml on main and inspect all 18 results,
synchronize dev by ancestry-preserving update, then remove only the merged
feature branch. npm publication is intentionally skipped. Final release/run
references and synchronization results will be recorded in the completion
response and GitHub Release notes.
