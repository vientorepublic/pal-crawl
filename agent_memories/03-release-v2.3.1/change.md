# Release v2.3.1

- Kind: handoff
- Status: active
- Created: 2026-10-25
- Last verified: 2026-10-25
- Scope: every non-ignored working-tree change, including the user's notification wording edits
- Evidence baseline: dev/main/origin refs at 2664267; feat/release-v2.3.1 carries the complete local changes

## Outcome and version decision

The user authorized releasing all working-tree changes through the project workflow. The user subsequently deferred npm publication after npm authentication returned HTTP 401. Complete the signed commits, feature-to-dev and dev-to-main merge PRs, GitHub Release, and return-to-dev synchronization; do not attempt npm publication in this run.

The current npm latest and root package version are 2.3.0. The previous v2.3.0 tag matches its remote object. Changes since that tag include package hygiene, plus this worktree's compatible transport/parsing fixes, sequential optional hydration, isolated tests, agent instructions/shared-memory adoption, and user-authored notification wording changes. Public declarations were checked in the compliance sweep without public changes. No new public capability or incompatible supported contract was introduced, so choose patch 2.3.1.

A fetch detected a pre-existing local/remote v2.0.5 tag mismatch. That historical tag was preserved; branch refs were refreshed with --no-tags. At preflight, local dev and origin/dev/main all matched. Other open Renovate PRs remain outside this release.

## Gates and publication plan

1. Set 2.3.1 with npm version --no-git-tag-version, then npm i and checksum-verified npm ci. Public dependency installation uses --userconfig /dev/null because the existing npm publishing credential is invalid. npm 12 blocked three install scripts by default; --allow-scripts cannot be used for project-scoped installs, so the official npm install-scripts approve command recorded exact-version allowScripts entries for puppeteer@25.13.0, @parcel/watcher@2.6.0, and unrs-resolver@1.12.2 after source review. No lifecycle-disabling or peer-compatibility bypass flags were used.
2. Run typecheck/lint/tests/build, offline contract checks, built API checks, relevant shell/notification verification, and release dry run; inspect payload and public declarations.
3. Review all tracked/untracked changes, sign commits with the configured key, push feature, and merge its PR into dev using a merge commit.
4. Promote dev into main via a merge PR; inspect the complete diff and wait for required test/build/contract-live checks without bypassing protection.
5. Verify final main, publish immutable v2.3.1 tag/GitHub Release at that commit, synchronize dev by a protection-compliant ancestry-preserving method, and clean up only the verified merged feature branch.
6. Record exact release refs/URLs, installed/check results, remote ancestry/content comparisons, and deferred npm state. Never store credentials or OTPs.

## Verification and final references

- npm i and clean npm ci succeeded with reviewed pinned install-script approvals; SHA-256 lockfile verification passed. Dependency resolutions are unchanged; only the two root lock versions changed to 2.3.1.
- Formatting produced no additional source changes. Typecheck, lint, tests (245 passed / 11 opt-in live tests skipped), build, contract self-test (12/12), source/manifest verification (44 selectors), and built API verification (17/17) passed after the clean installation.
- Seven emitted public declaration files still match the original HEAD API after excluding private members/comments.
- Notification shell syntax and all three dry-run modes passed, including the user's package-version label and webhook titles. No issue/webhook was sent.
- npm release dry run passed, including prepublishOnly/prepack checks. The first payload inspection found root agent/development configuration in the tarball; .npmignore was tightened to retain only runtime dist files plus mandatory package/README/license metadata. The final dry run passed with exactly 24 files: 21 runtime dist files plus package.json, README.md, and LICENSE; no compiled tests, agent guidance/memory, scripts, or development configuration.
- Existing dependency audit findings: handlebars 4.7.9 (critical, development), undici 7.30.0 and zod 4.6.5 (high, production transitive). These pre-existing dependency versions were not changed. Routine updates remain with Renovate.

GitHub integration/publication is pending. Final immutable commit/tag, merge PRs, and synchronization results will be recorded in the GitHub Release notes and completion response; the release link is [v2.3.1](https://github.com/vientorepublic/pal-crawl/releases/tag/v2.3.1). npm publication is explicitly deferred by the user; registry latest remains 2.3.0.
