# Changelog

## 1.1.0 - 2026-11-26

- New `ship` plugin skills: `ship` opens one pull request with gate proof, `release` prepares a version and its tag command, and `rollout-check` finds gaps in the team setup. Each has an eval and routing samples.
- README now covers `kaas-blueprint mcp`, `init --team` and the Go factory.
- Every catalogue entry is pinned to a full commit sha. Release moves own entries to the `v1.1.0` tag.

## 1.0.0 - 2026-11-19

First stable release.

- Installs skills into Claude, Codex, Cursor, Pi and shared agent skill folders with `kaas-blueprint add`.
- `kaas-blueprint list` shows the catalogue. `kaas-blueprint mcp` serves it to any coding agent.
- `kaas-blueprint init --team` writes the shared team setup: AGENTS.md, per-agent pointers, settings, hooks and rules.
- Vendored skills from addyosmani/agent-skills, mattpocock/skills and obra/superpowers are pinned by commit and file hash. All three pins checked current on release day.
- Routing eval: 69 cases, 65 correct at rank 1 (94.2%). It is deterministic, calls no model, and runs in `make check`. The gate needs at least 90% and at least 20 cases.
- A test packs the tarball and runs `init --team` from it in a fresh repo.
- Release workflow publishes to npm when a `v*` tag is pushed.

## 0.1.0

Early preview.
