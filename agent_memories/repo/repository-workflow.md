# Repository Workflow Context

- Kind: decision
- Status: active
- Last verified: 2026-10-25
- Scope: pal-crawl repository and guideline adoption
- Evidence: `AGENTS.md`, `package.json`, `renovate.json`, `.github/workflows/test.yml`, `.github/workflows/build.yml`, local Git inspection
- Related: [adoption record](../01-guidelines-and-memory/change.md)

## Confirmed topology and initial state

This is one Git repository and one npm package. The inspected remote is `https://github.com/vientorepublic/pal-crawl.git`; the initial local branch was `dev` tracking `origin/dev`. `scripts/notify-site-drift.sh` already had an unstaged user change. This documentation task preserves it and does not switch branches, stage files, or commit it. Remote branch freshness and branch protections were not checked.

## Adopted policy and implementation gap

The user requested adoption of Gatekeeper's agent instructions with pal-crawl project/structure descriptions. `AGENTS.md` now owns the policy, including `feat/* -> dev -> main`, English new source comments/technical memories, semantic versioning, clean-install gates, and publication/synchronization checks.

Existing public `I*` names remain compatible; new interfaces use the imported naming convention. Existing Korean source comments remain historical content and should not trigger unrelated translation changes. The old automatic version commit/tag process is replaced by reviewed package edits and tags at the verified final main commit.

The actual Test/Build/PR-contract workflows still target `main` only. Adoption does not create dev-target CI or change Renovate's dev base. Feature-to-dev integration therefore relies on the required local package gate. This is a known workflow characteristic, not evidence that dev PRs passed CI.

This is a policy migration only. No GitHub settings, branches, protection rules, workflows, releases, package versions, or npm publication state were changed. Operational commands and completion requirements are defined only in AGENTS.md; consult it instead of duplicating policy here.
