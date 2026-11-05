BRANCH: cluster/blueprint-v0.2-skills
HEAD: 5ff8bcd57dfad8e4c90992186a8bf8a9abec8e49
## Summary
The seven upstream skills, their pins and the company-mention guards were already on the base branch. I added the three agents, the two rules and a check with tests and mutations that loads them. The eight private skills are blocked because the private kit is not reachable.
## Issues
- #8: partly done.
  - Seven upstream skills pinned by commit with licence, and a test fails when bytes differ: already held. `upstreams.json` plus `scripts/check-vendor.mjs`; test "fails when one byte changed" in `tests/check-vendor.test.mjs`; mutation `tests/mutations/vendor.json`. No code changed.
  - Eight private skills with no company mention: blocked, the kit is unreachable here, the supervisor imports them with `scripts/import-kit.mjs`. The guard already held: "refuses a leak and writes nothing" in `tests/import-kit.test.mjs` (`tests/mutations/import.json`) and the banned-word scan in `scripts/check-structure.mjs` (`tests/check-structure.test.mjs`, `tests/mutations.json`).
  - Three agents (verifier, complexity-surgeon, gate-triage) and two rules (engineering, comments): done. They are written fresh, not copied from the kit. Test "loads the three agents and two rules in this repo" and the four fixture failure tests in `tests/check-agents.test.mjs`; mutations in `tests/mutations/agents.json` (4, all caught by `node scripts/check-mutations.mjs`).
  - Hooks: out of scope.
## Staged workflow changes
none
## Files outside my area
none
## Gate evidence
make check: `# pass 115` / `# fail 0`; `mutations: ok`
## Risk and rollback
Low. Adds new files and one new check that `make check` runs automatically. Roll back by reverting commit 5ff8bcd.
## Learnings
- The repo uses node and make, with no bun.lock or package-lock.json, so the install step in the brief does not apply. The factory default should detect that.
- `make test TEST_ARGS="--rerun-each 3"` ignores TEST_ARGS (the Makefile does not pass it) and node's test runner has no rerun flag. I ran the new test file once under make. The Makefile should pass TEST_ARGS.
- `scripts/check-structure.mjs` runs its checks on import, so another check cannot reuse its `frontmatter()`.
- No AGENTS.md exists, so the "things that change together" pairs could not be updated.
- The brief's `/tmp/report.md` collides across agents. I used `/tmp/rep/report.md`.
