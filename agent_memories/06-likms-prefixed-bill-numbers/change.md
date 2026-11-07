# LIKMS prefixed bill numbers

- Kind: plan
- Status: resolved
- Created: 2026-11-07
- Last verified: 2026-11-07
- Scope: LIKMS live list contract, detail title parsing, and NSM adapter search
- Change type: compatible bug fix
- Evidence baseline: clean dev and remote dev/main at 75c2901; feature branch feat/likms-prefixed-bill-numbers
- Related: [daily run 42293262282](https://github.com/vientorepublic/pal-crawl/actions/runs/42293262282), [issue 110](https://github.com/vientorepublic/pal-crawl/issues/110)

## Outcome and acceptance criteria

Accept numeric and ZZ-prefixed LIKMS bill numbers while still rejecting blank or
unexpected forms. Preserve the original bill number in list and detail results,
strip a recognized prefix from the detail title, and use the bill-number filter
for recognized identifiers. Preserve title search, numeric IDs, request/transport
contracts, and public API signatures. No changes to PAL or NSM site contracts.

## Contracts and consumers

The referenced Actions report and a local live replay each had 14 passes, one
drift, and three dependent skips. The only failure, likms/state-list-parse,
rejected ZZ22145 under a digits-only pattern.

The live 50-row search response returned ZZ22145 for a presidential hearing
request (bill kind BKC_0016, PRC_F6B0D23033474CCABBB7FE9C946E78).
The list cell title, visible text, and anchor data-bill_no all agreed. The
detail page form and billInfo.do receipt row repeated the same value.
The existing list parser preserved it correctly. The detail parser preserved
the form number but left the bracketed ID in the title, and the adapter routed
the identifier to billNm instead of billNo. Direct LIKMS search by billNo
returned exactly that bill, and findBillDetail.do resolved the same billId.

## Implementation

1. Use the reduced live row and title as parser fixtures. Exercise the actual
   manifest field in detector self-tests, including mixed, blank, prefix-only,
   and unrecognized-prefix values.
2. Accept numeric and optional ZZ-prefixed numeric IDs in the manifest, without
   broadening the NSM contract. Share the LIKMS ID pattern internally between
   title parsing and adapter filter routing. Preserve ordinary bracketed text.
3. Document string IDs and query routing. Select patch 2.3.4 against dev and
   the latest local tag 2.3.3; no dependency change or new public export.

## Verification

- Original manifest with new regression: mixed-number detector self-test failed
  as expected (exit 1).
- Original parser/adapter with new regressions: three focused Jest failures
  (two title cases, one search routing case; exit 1).
- Node 24.22.1 / npm 12.2.0: npm install and clean npm ci succeeded with
  the existing script approvals. The lockfile checksum stayed unchanged across
  npm ci; the diff contains only the root version bump. npm reported 32
  dependency audit findings; no dependency resolutions were changed.
- Clean-install checks passed: typecheck, lint, Jest (252 passed, 11 opt-in
  live tests skipped), build, detector self-tests (34/34), manifest alignment
  (44 selectors), built API verification (17/17), and git diff --check.
- The full live run passed all 18 checks (exit 0). It exercised ZZ22145 in
  likms/detail-flow and ran all three previously skipped checks.
- A separate live adapter probe returned one exact match for ZZ22145 and the
  detail title without the bracketed prefix (exit 0).

## Completion and handoff

The implementation and patch version were verified locally. The follow-up
authorizes the signed feature commit, merge PRs into dev and then main, the
v2.3.4 GitHub release, and a fresh main-branch contract workflow run. npm
publication is excluded. The release and workflow provide the final remote
evidence.
