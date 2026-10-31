# Shared Agent Memory Index

Last reviewed: 2026-10-31

Read [AGENTS.md](../AGENTS.md) and this index before non-trivial work. These notes are versioned repository context, not synchronization of private chats. Current source and explicit user instructions take precedence over historical notes.

## Canonical repository notes

- [Project architecture](repo/project-architecture.md) — current, source-reviewed 2026-10-25; package boundaries, request/parse/adapter flow, exports, and site contracts.
- [Repository workflow](repo/repository-workflow.md) — current, reviewed 2026-10-25; single-package Git context and adoption of the Gatekeeper workflow. Read before Git/package work.
- [Verification notes](repo/verification-notes.md) — current, source-reviewed 2026-10-25; actual commands, offline/live separation, and limitations. Read before validation.

## Topic investigations and plans

- [05 — Empty detail reasons](05-empty-detail-reasons/change.md) — resolved locally; valid empty NSM/LIKMS reasons accepted; 247 tests, 30 self-tests, and all 18 live contracts passed; patch 2.3.3 GitHub release and post-merge workflow authorized; npm excluded.

- [04 — LIKMS committee contract](04-likms-committee-contract/change.md) — active release; false positive fixed, 16 self-tests and all 18 live contracts passed; GitHub integration and post-release dispatch authorized, npm excluded.

- [03 — Release v2.3.1](03-release-v2.3.1/change.md) — active; all working-tree changes authorized for GitHub release; npm publication deferred by the user.

- [02 — Guideline compliance sweep](02-guideline-compliance/change.md) — resolved locally; transport/parsing safety, offline test isolation, sequential hydration, and typing/language compliance. 245 tests passed; public declarations unchanged.

- [01 — Guidelines and memory adoption](01-guidelines-and-memory/change.md) — resolved locally; Gatekeeper policy adapted to pal-crawl, current index/canonical notes/templates added, historical records preserved. No commit, PR, or publication performed.

Reserve the next available topic number after inspecting the directory. New notes use the next available number (`04-descriptive-topic/` onward). Track `draft`, `active`, `blocked`, `resolved`, or `superseded` explicitly. A proposed plan is not an accepted decision.

## Historical evidence

- [Legacy record index](INDEX.md) — historical; 25 records from 2026-10-13/14 with their original paths, statuses, and activity log. An old `active` label is not a current guarantee.
- [Legacy record format](LEGACY-FORMAT.md) and [legacy template](_templates/memory.md) — historical append-only format retained for interpreting existing records. New notes use the templates below.
- `decisions/`, `tasks/`, `site-notes/`, and `findings/` retain existing evidence and supersession chains. Do not add new records there. Link relevant historical evidence from new topic notes and promote only source-verified current facts into `repo/`.
- Historical npm OTP, publication, protection, and site measurements require renewed verification before operational use. This documentation pass did not verify remote/npm state or reproduce old findings.

## Writing and sharing

1. Search this index and existing notes before adding a file; update the canonical source where appropriate.
2. Use [memory-template.md](templates/memory-template.md) for investigations/decisions/handoffs and [change-template.md](templates/change-template.md) for substantial implementation.
3. Write new technical notes in English. Include repository-relative evidence paths, source symbols or commit IDs, verification date, status, and concrete next actions.
4. Update this index with every new/renamed/archived note. Update a note's verification date only after reviewing its evidence. Preserve legacy append-only bodies and link replacements.
5. Record commands actually run and their results separately from suggested/unrun checks. Never include secrets or private production data.
6. Commit shared memory with related work when committing is in scope. Promote durable findings to `repo/`, resolve completed plans, and avoid copying policy from AGENTS.md.
