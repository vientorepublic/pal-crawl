# pal-crawl — Shared Agent Guidelines

These instructions apply to this repository. Read this file before editing. Follow explicit user instructions and applicable, more specific `AGENTS.md` files; report conflicts instead of silently inventing exceptions.

## 1. Project and repository boundaries

pal-crawl is an npm-distributed TypeScript library for crawling Korean legislative websites. It is a single package, not an application server, CLI, npm workspace, or submodule-based meta repository.

- `pal.assembly.go.kr`: `PalCrawl` requests notice lists/details; `PalParser` parses their HTML.
- `opinion.lawmaking.go.kr`: `NsmLmSts` and `NsmLmStsParser` provide legislative-status lists/details.
- `likms.assembly.go.kr`: `LikmsCrawler` hydrates proposal reasons; `LikmsStateCrawler`, `LikmsStateParser`, and `LikmsDetailParser` provide bill search/details. `LikmsNsmAdapter` implements the NSM-compatible list/detail ports.
- The root `package.json` owns the library version. `src/index.ts` is the public API barrel; `dist/` contains emitted CommonJS JavaScript, declarations, and source maps. `.npmignore` excludes source, scripts, shared memory, and compiled tests from publication.
- The current compiler uses CommonJS / ES2020 with declaration output. CI uses Node.js 24. Use a consistent Node/npm toolchain and read actual configuration before changing supported runtimes.
- Keep network requests in crawlers/`HttpClient`, HTML parsing in parsers, and compatibility mapping in the adapter. Screenshots are optional through `ScreenshotBase`; preserve the HTTP + Cheerio default path.

Primary source locations:

```text
src/
  index.ts                    Public API exports
  config.ts                   Site domains, endpoints, and shared constants
  http-client.ts              Requests, retries, timeouts, encoding fallback
  parser.ts                   PAL, NSM, and LIKMS parsers and result interfaces
  pal.ts                      PAL/NSM crawlers, bulk options, ScreenshotBase
  likms.ts                    LIKMS hydration, state search, and detail requests
  nsm-compat.ts               NSM list/detail ports and LikmsNsmAdapter
  *.test.ts                   Colocated Jest tests and inline HTML fixtures
  likms.live.test.ts          Explicitly enabled live integration tests
scripts/
  verify-dist.js              Built public API verification
  check-site-drift.js         Live crawler contract checks and offline self-tests
  drift-contracts/            Site contracts and source/manifest verification
  notify-site-drift.sh        Contract check notifications
.github/workflows/            Test, Build, PR and daily contract checks
agent_memories/                Shared, versioned context for all agents
```

Read [README.md](README.md), `package.json`, compiler/lint configuration, and affected site contracts before changing behavior. Current architecture evidence is in [project-architecture.md](agent_memories/repo/project-architecture.md).

## 2. Required session workflow

1. Read [the memory index](agent_memories/README.md), relevant `repo/` notes, and active topic notes before non-trivial work. Historical records remain available through [the legacy index](agent_memories/INDEX.md).
2. Inspect Git status, branch, unstaged/staged diffs, and remotes. Identify existing user changes before editing. Never reset, stash, commit, or overwrite unrelated work.
3. Check applicable nested instructions. Do not claim memory or external context was loaded unless it was actually read.
4. Define observable acceptance criteria, trace affected contracts/consumers, implement in dependency order, and verify the final state. Use [the change template](agent_memories/templates/change-template.md) for non-trivial work; small local edits can record the same essentials in the task response. Section 9 defines the feature change workflow.
5. Before committing or pushing, follow sections 4–7. Finish by reporting changed files, checks actually run, failures/omissions, and unresolved publication or release work.

Memory is repository content, not automatic live synchronization. Other agents receive updates through a shared worktree or normal Git synchronization. Read again after relevant updates; never assume another agent's private chat is shared memory.

## 3. TypeScript, library, and comment conventions

### General TypeScript

- Existing ESLint, Prettier, and TypeScript configuration is authoritative for formatting and compilation. Do not weaken rules or change compiler/module settings to conceal errors.
- Use `const` by default, `let` for reassignment, strict equality, explicit control flow, and small functions with clear responsibilities. Avoid `var`, mutable global state, and unrelated abstractions.
- Use camelCase for variables/functions, PascalCase for classes/types/interfaces, and UPPER_SNAKE_CASE for true shared constants. Do not add `I` prefixes to new interfaces. Preserve established filenames and public names, including existing exported `I*` interfaces; do not rename them merely for style.
- Preserve kebab-case filenames and colocated `.test.ts` files. Prefer explicit return types at exported APIs and domain boundaries, inferred types for obvious locals, `unknown` plus narrowing for untrusted data, and discriminated unions for state. Avoid new `any`, unsafe casts, non-null assertions, and ignored type errors unless a documented interop constraint requires them.
- Use `import`/`export` syntax and type-only imports where compatible. Preserve the current CommonJS output and extensionless relative imports unless an intentional compatibility change requires otherwise.
- Await or deliberately handle promises; handle errors with context and preserve their causes. Avoid empty catch blocks, fire-and-forget failures, and logging tokens or sensitive payloads.
- Validate external inputs at runtime. TypeScript types and generic request casts do not validate HTTP responses.

### Library and crawler boundaries

- Prettier currently uses two-space indentation, single quotes, trailing commas, and width 80. ESLint uses flat configuration; `npm run lint` includes `--fix`, so inspect mutations.
- Keep parsers safe for empty/malformed HTML: return empty arrays, `null`, or zero rather than throwing. Preserve `null` for missing parsed values; unspecified configuration uses optional properties and `??` defaults.
- Keep transport retries/timeouts and decoding in `HttpClient`. Preserve the UTF-8/cp949/euc-kr fallback for incorrectly declared government-site responses. Required requests may reject with contextual errors; do not silently convert network failures into successful empty results.
- Optional hydration must preserve the original data when enrichment fails. A documented catch that intentionally keeps the original value is allowed here; do not extend this exception to required requests or validation errors.
- Default external requests to sequential execution. Use the existing bulk delay/concurrency options for controlled parallelism; do not introduce aggressive defaults.
- New public APIs must be exported deliberately from `src/index.ts` and documented in README in the same change. Review emitted declarations and NSM compatibility ports when changing public contracts.
- Keep browser startup optional and explicit; close resources through the existing screenshot lifecycle. Do not introduce browser execution into the default HTTP parsing path.
- Do not add `console.*` in library source; tests and operational scripts may report their results without exposing secrets.

### Comments and language

- **All new or edited source comments and docstrings must be English. The only non-English exception is a proper noun in its original spelling.** This covers TypeScript/JavaScript, JSDoc, HTML, CSS, JSONC, YAML, shell, configuration examples, and generated source comments added by an agent.
- Quoting ordinary Korean text does not create an exception. Describe a label or fixture through its English identifier instead of copying non-English prose into a comment.
- Explain reasons, constraints, units, invariants, and surprising behavior. Avoid comments that restate code, stale commented-out code, decorative banners, and mandatory JSDoc on trivial functions.
- Use JSDoc for non-obvious exported contracts, side effects, failure modes, and security assumptions. `TODO`/`FIXME` must state the actionable issue and link an issue or memory when available.
- Identifiers, test titles (`describe`/`it`/`test`), commit subjects, and new technical memory notes are English. User-facing copy, fixtures, and documentation written for Korean readers can remain Korean; they are not source comments.
- Existing Korean comments are legacy content. Apply the new rule when adding/editing a comment; keep unrelated translation work separate from behavior changes.

## 4. Version policy

The root package owns one library version. Compare with the latest integration-branch version and existing release tags before choosing a free version.

- **Major (`X.0.0`)**: incompatible public exports/signatures, result shapes, query semantics, configuration, or supported-runtime changes requiring consumer action. Include migration guidance. A dependency major alone does not require a library major if compatibility is preserved.
- **Minor (`x.Y.0`)**: backward-compatible features, optional fields/configuration, and new supported capabilities.
- **Patch (`x.y.Z`)**: compatible bug/security fixes, dependency updates, performance work, internal refactors, and package maintenance/tests with no new public capability.
- Reset lower components when bumping major/minor. Use the highest required level in a combined change. Check actual declarations and consumer behavior, not commit prefixes alone.
- Do not bump again if the branch already contains a sufficient unreleased bump against the integration base. Reuse it during review fixes; reconcile if another release consumed it. Do not bump merely to push the same commit.
- Agent instructions and memory-only documentation changes do not require a package version bump or dependency installation.
- Use `npm version <major|minor|patch> --no-git-tag-version` for a reviewed version change without an implicit commit/tag. Create the release tag only after verifying the final `main` commit and matching package version.
- A user deployment/publication command includes version/lockfile gates, commits/pushes, `feat/* -> dev -> main` PR merges, GitHub Release, npm publication, and return-to-dev synchronization for the stated library scope. A feature implementation or version bump alone does not authorize publication.
- Tags use `vX.Y.Z`; GitHub Releases use `release: vX.Y.Z` with generated notes. Target the final verified `main` commit. Distinguish GitHub Release creation from successful npm publication; report authentication/OTP failures explicitly.

## 5. Mandatory package and lockfile gate

Before committing package implementation, complete this sequence at the repository root. Documentation-only instructions/memory changes use section 7's documentation gate.

1. Review pre-existing manifest/lock changes and select the correct package version under section 4. Do not include unrelated dependency upgrades; Renovate owns routine dependency refreshes and targets `dev`.
2. Run **`npm i`** after final version/dependency changes. Review the complete manifest/lock diff and include intentional resolutions together. Do not hand-edit dependency resolutions, delete the lockfile, or substitute `--package-lock-only` for installation.
3. With npm 12+, review required dependency install scripts and record exact-version approvals using `npm install-scripts approve <package>` when needed. Do not disable lifecycle scripts or blanket-approve unreviewed scripts. Keep the resulting `allowScripts` metadata with the package.
4. Record the lockfile checksum, then run **`npm ci`** with normal development dependencies. Confirm installation succeeds, the checksum is unchanged, root versions match, and the dependency diff is intentional. `npm ci` replaces `node_modules`; coordinate if another process uses it.
5. Run section 7's affected checks against the clean installation. Inspect formatter/linter mutations and stage intended manifest/lock changes with the implementation.
6. Inspect the staged diff and run `git diff --cached --check`. No uncommitted lockfile change may be necessary for the committed package to install.

Before each push, verify the committed package state passed these gates. Repeat installation and affected checks after a merge or package edit changes the verified state. An unchanged verified commit needs no artificial bump.

Do not use `--force`, `--legacy-peer-deps`, disabled lifecycle scripts, or weakened checks to disguise incompatibility. Report installation failures and stop the commit/push gate until resolved. If the environment prevents a required check, report it as blocked, never as passed.

## 6. Git, GitHub, and release lifecycle

### Preflight and ownership

- Inspect `git status --short --branch`, `git diff`, `git diff --cached`, and remotes. This repository currently has no child-repository pointer workflow; do not invent submodules or composition releases.
- Start new work from an up-to-date local `dev` tracking `origin/dev`, then create `feat/<topic>`. Preserve in-progress branches/dirty work; do not switch them merely to enforce a convention. Do not commit directly to shared `main`/`dev`, force-push them, reset existing work, or use routine stashes.
- Integrate through `feat/* -> dev -> main`; ordinary development may stop before promotion to main, while publication includes both merges. This replaces the former feature-to-main workflow.
- Preserve merge-based history (`pull.rebase = false`). Use merge commits for both feature integration and shared-branch promotions; do not squash or rewrite published history.
- Honor configured signing requirements without disabling them. Check `commit.gpgsign` and `user.signingkey`; sign with `-S` when a signing key is configured but automatic signing is off. Do not generate a key just for this task.
- Use scoped Conventional Commits, e.g. `fix(parser): preserve proposal reason line breaks`, `docs(agents): adopt shared memory workflow`, `chore(release): prepare v2.4.0`.

### GitHub operations

- Use `gh` for PRs, issues, Renovate dashboards, Actions/checks, repository metadata, and Releases; use `gh api` for missing surfaces. Local commits/branches/diffs and fetch/pull/push use `git`. Do not replace GitHub operations with browser automation or direct HTTP calls.
- Verify `gh auth status`. If `gh` is missing or unauthenticated, stop remote work and report the required installation/authentication; do not attempt automatic login or request a token. Use explicit `--repo vientorepublic/pal-crawl` or `repos/vientorepublic/pal-crawl/...` API endpoints.
- Use `gh pr create/view/checks/merge` for both promotion PRs. Inspect the entire `dev -> main` diff for other integrated work before publication. Required reviews/checks remain mandatory; do not use `--admin` or disable protections. Queued/auto-merge is not a completed merge.
- Current CI triggers only on PRs targeting `main`. Feature/Renovate PRs into `dev` therefore require the full local gate; do not claim missing CI ran. Changing this trigger requires an explicit workflow change.
- Main-target PRs run `test`, `build`, and `contract-live` jobs. Recheck live protection settings before release; historical memory is not proof of current branch protection.
- Put change type, affected sites/parsers, compatibility/version rationale, and actual validation in the PR body. Keep one purpose per PR; do not mix parser changes with unrelated formatting or dependency updates.

### Publication and return to development

1. Verify release scope and package version, complete sections 4–5 and local checks, review the npm payload with `npm run release:dry`, and resolve unintended packaged files. Never expose credentials or OTPs in notes.
2. Push the feature, merge its verified PR into `dev`, then promote `dev` into `main` through a merge PR. Use `gh pr checks --watch` and inspect the final diff/checks before each merge; missing dev-target CI does not replace local checks.
3. Fetch the final `main` commit, confirm its tree/package version, and verify the intended tag is unused. Create/push `vX.Y.Z` at that exact verified commit, publish `gh release create vX.Y.Z --repo vientorepublic/pal-crawl --title "release: vX.Y.Z" --generate-notes`, then run `npm publish` from the verified tree. Do not use `release:patch/minor/major` shortcuts that implicitly create a commit/tag before final integration.
4. Record the immutable commit/tag, GitHub Release URL, and actual npm publication result. If publication fails, preserve successful stages and identify the remaining action rather than creating another version blindly.
5. Fetch and classify `origin/main` versus `origin/dev` by ancestry and content. Equal tips are synchronized. If main is already an ancestor of dev, classify remaining changes and avoid redundant synchronization PRs. If dev is an ancestor of verified main, prefer a protection-compliant fast-forward remote ref update through `gh api` with `force=false`, checking refs immediately before/after. Stop and reclassify concurrent movement.
6. If protections require a PR or histories diverge, inspect the full diff and use one ancestry-preserving main-to-dev PR. Do not bypass protection or repeatedly merge merely to clear an ahead/behind badge. Return the local checkout to dev and fast-forward from origin/dev only when safe; preserve unrelated dirty work.
7. Record `git rev-list --left-right --count origin/main...origin/dev`, `git log --left-right --oneline origin/main...origin/dev`, and `git diff --stat origin/main origin/dev` separately from local tracking status. Empty content differences do not prove equal tips. Do not create empty commits/releases/promotions for history-only differences.
8. After a feature PR is actually MERGED, verify repository/head identity, integrated work, dependent PRs, and worktree usage before cleanup. Return to updated dev, use `git branch -d` locally and `gh` for the verified remote feature ref, then fetch/prune. If safety cannot be established or `-d` refuses, preserve the branch and report why. Never use `-D` or delete shared/unmerged/unrelated branches.

For future external shared-library changes, publish the upstream artifact in its owning repository before updating this package's dependency and lockfile. A dependency edit here does not authorize publishing an upstream package.

## 7. Verification and security

Run the baseline package gate at the repository root after section 5:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
```

Inspect lint mutations. `npm run format` writes all TypeScript files; avoid unrelated formatting. For parser, crawler, adapter, or contract-checker changes, also run the relevant existing checks:

```bash
npm run drift:self-test
npm run drift:contracts
npm run verify:dist
```

- Tests live beside source in `src/*.test.ts` and use Jest/ts-jest. Use behavior-focused English test titles and inline HTML fixtures. Mock required network requests; the default suite must not contact external sites. Existing private-client mock casts are allowed test interop, not a reason to weaken production types.
- Add meaningful regression fixtures before changing parser behavior. Verify malformed/empty responses and failure paths as well as successful parsing. Update mocks when site contracts change; mocks alone are not proof of live compatibility.
- Live checks are separate: `LIKMS_LIVE_TEST=1 npm test -- --runInBand src/likms.live.test.ts`, `npm run verify:dist:live`, and `npm run drift:check`. They contact real sites; run relevant checks with controlled load and report environmental failures distinctly. Derive volatile totals/titles from responses instead of hardcoding live data.
- Keep `scripts/drift-contracts/` aligned with selectors, endpoints, and parsed fields in the same change. The contract checker distinguishes drift (exit 1) from inconclusive transport failure (exit 2). It retries inconclusive checks once after a delay by default; confirmed drift must not disappear behind a successful retry.
- PR contract workflow blocks confirmed drift; inconclusive checks remaining after retry are warnings. Daily checks run at 06:00 KST, and notifications use the `crawler-contract` label. Inspect actual workflow files before assuming current remote execution or protection status.
- Documentation-only instructions/memory changes require local link/path review and `git diff --check`; do not install dependencies, run the package suite, or bump versions merely to edit these documents. This exception also applies before committing/pushing those documentation changes.
- Do not commit credentials, `.env`, tokens, raw API keys, production user data, secret-bearing logs, OS/editor files, or agent runtime state such as `.freebuff/`. Use placeholders in configuration examples and inspect `.gitignore`/`.npmignore` before publication.
- Track security findings with sanitized reproduction evidence; distinguish confirmed behavior from potential risks. Successful installation alone does not establish dependency safety.

## 8. Shared memory maintenance

- `agent_memories/repo/`: current cross-cutting architecture, verification, workflow context, and approved decisions.
- `agent_memories/NN-topic-name/`: numbered investigations, implementation plans, findings, and handoffs for a bounded topic. Reserve a unique next number after checking existing folders; do not overwrite another session.
- [The index](agent_memories/README.md) is the entry point; update it with every new/renamed/archived note and maintain explicit status and links. Use English kebab-case names and one topic per file; split long notes around 300–500 lines.
- Use [the memory template](agent_memories/templates/memory-template.md). Record date, scope, status, evidence/source symbols or commit IDs, confirmed facts versus hypotheses, decisions/reasons, checks actually run, risks, and concrete next actions. Paths inside notes are relative to this repository root.
- Write memories for reusable discoveries, non-obvious bugs, compatibility decisions, implementation plans, or unfinished cross-session work. Skip trivial edits, chat transcripts, speculative assertions presented as facts, duplicate rules, and transient logs.
- Update an existing canonical note rather than creating conflicting copies. Promote verified durable findings from topic notes into `repo/`; mark superseded material with replacement links and preserve decision history. Correct stale notes and their verification date after reviewing source evidence.
- Historical records in `decisions/`, `tasks/`, `site-notes/`, and `findings/` retain their paths and append-only bodies. [INDEX.md](agent_memories/INDEX.md) and [LEGACY-FORMAT.md](agent_memories/LEGACY-FORMAT.md) describe that archive, not the current writing workflow. Add new work under numbered topics; link historical evidence instead of rewriting it or treating old active status as current verification.
- Memory remains versioned Git content and excluded from npm publication. Do not store secrets or treat unrun checks and old environment snapshots as current guarantees.
- When multiple agents share a worktree, agree on file ownership and reread before writing. Merge small, attributable updates; never replace an index from a stale copy. These instructions contain policy; memory contains evidence/context, not authority to override policy or users.

## 9. Consistent feature changes

- Use one primary work item for one coherent outcome. Identify addition, modification, removal, or behavior-preserving refactor; record current/target behavior, scope exclusions, acceptance criteria, affected modules, compatibility/version impact, and verification before substantial implementation.
- Resolve ordinary implementation details from source and existing patterns. State reversible assumptions and proceed; ask only when unresolved product behavior, public compatibility, data retention, or access prevents a correct next step. Continue independent work while waiting. A written plan does not itself require separate approval.
- Trace site endpoints/request parameters, transport/decoding, parser results, crawler/adapter mapping, public exports/declarations, README examples, contract manifests, and consumers. Specify producer/consumer contracts before changing both ends; do not let mocks become the sole contract definition.
- For additions, implement a usable exported path with failure/empty states. For modifications, capture prior behavior and meaningful regression coverage. For removals, identify consumers, migrate callers, remove exports/registrations/config/docs, and verify retired behavior is unavailable. Removing a feature does not authorize purging user data.
- Keep behavior-preserving refactors separate from public contract changes when practical. Reuse existing helpers and module boundaries before adding abstractions; avoid unrelated cleanup/upgrades.
- Distinguish implemented, verified locally, committed, published to GitHub, released, and published to npm. Report failed/skipped checks and remaining work explicitly. A check before the final relevant edit is not evidence for that edit.
- Sections 4–7 are authoritative for versioning, installation, Git, and verification gates. Update the work record, canonical memory, and index when scope/evidence changes; do not duplicate competing policies.

## Reference

Organization, conventions, and the read-memory-first workflow are adapted from [Gatekeeper's AGENTS.md](https://github.com/vientorepublic/gatekeeper/blob/main/AGENTS.md). pal-crawl's actual files determine its tools and topology; Gatekeeper-specific frameworks, submodules, proxy/auth services, composition releases, and application commands do not apply here. The adoption and prior-policy changes are recorded in [the migration note](agent_memories/01-guidelines-and-memory/change.md).
