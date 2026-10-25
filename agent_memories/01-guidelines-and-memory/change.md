# Gatekeeper Guidelines and Shared Memory Adoption

- Kind: decision
- Status: resolved
- Created: 2026-10-25
- Last verified: 2026-10-25
- Scope: `AGENTS.md`, shared-memory entry point, canonical context, and templates
- Evidence baseline: local `dev`; existing unrelated `scripts/notify-site-drift.sh` modification
- Related: [current index](../README.md), [historical records](../INDEX.md), [reference instructions](https://github.com/vientorepublic/gatekeeper/blob/main/AGENTS.md)

## Context and acceptance criteria

The user requested adoption of Gatekeeper's agent instructions with this project's description and structure substituted, including memory restructuring if useful. The resulting instructions must describe the actual single npm library, preserve public compatibility, provide working local reference links, and keep historical evidence accessible without changing application code or unrelated user work.

## Verified findings and decision

The reference was read through authenticated `gh api`. Gatekeeper is a multi-repository application, whereas pal-crawl is one npm library. Its NestJS/Svelte/submodule/composition-release instructions and app commands have no corresponding target here. Those parts were mapped to actual crawler/parser/adapter, package, contract-check, and npm-release boundaries.

Adopted shared principles include explicit session preflight, English new comments and technical memory, preserving existing public names, semantic version selection, install/lock checks for package work, protected merge-based feature-to-dev-to-main integration, immutable final-main release tags, careful synchronization/cleanup, and evidence-based completion reporting. Package publication belongs to deployment scope for this npm library.

The historical Korean-comment and `I`-prefix policies are superseded for new work. Existing exported names are preserved. Historical early `npm version` commit/tag creation and direct feature-to-main promotion are replaced by the imported reviewed-version/final-main-tag and integration flow. Existing main-only CI triggers remain unchanged and are explicitly documented.

The memory entry point is now `agent_memories/README.md`. Current source-backed context lives under `repo/`, new bounded topics use numbered folders, and templates live under `templates/`. The 25 legacy records, their supersession chains, original paths, and old index remain intact. `LEGACY-FORMAT.md` preserves their former format guide; the old template is historical. This avoids rewriting historical bodies or invalidating external links. Legacy active statuses do not imply current verification.

## Verification

- Authenticated `gh auth status` and `gh api` reads succeeded outside the restricted sandbox. The sandbox-only authentication probe could not access the valid keyring session.
- Reviewed `src/index.ts`, class/export locations, package/compiler configuration, Renovate, workflow triggers, and npm exclusions.
- Local Markdown file links and documented source paths: checked for existence.
- All 25 legacy record bodies, the original index activity log, and the legacy template: preserved.
- `git diff --check`: passed.
- Typecheck/lint/tests/build/install and live-site checks: not run; this is an instructions/memory-only change using the documentation gate.
- No commit, push, PR, merge, GitHub settings change, version bump, release, or npm publication was performed. The existing notification-script change was preserved.

## Handoff

No implementation work remains for this documentation adoption. Future package or publication work must read current AGENTS.md and reverify remote settings, historical npm findings, site measurements, and package checks as needed. New topics start at the next available number after checking the directory.
