BRANCH: cluster/docs
HEAD: 50e14d38f646426df76b33e8253095c86d5c7909
## Summary
Rewrote the README (100 lines) so every command in it was run and works, and added scripts/check-docs.mjs, wired into make check, which fails when a sh or bash block in the README names a missing Make target or script.
## Acceptance
- Inventory -> every README command run from a clone: make check (works), list, list --json, add, add <group>, add unknown (exit 2), --global with --dir (exit 2), --help (works), npm pack plus npx tarball (works, covered by tests/package.test.mjs; npx by hand is refused by this sandbox), upgrade-pins (README fixed: it has no help flag and a bare run changes files; --dry-run documented). Removed: "Layout" claim that each group has skills (ship has none yet, now stated). Only README.md is a prose doc; no docs/ folder, no other links. -> done
- README shape (two sentences, install, first command with real output, next steps, 100 lines, no em dashes) -> check-prose, check-structure -> done
- Stale content gone -> README no longer claims ship has skills; added a one line note that the factory side is the old Bun/TS factory and is unchecked against the Go rewrite. KaaS-factory next README on the clone was still the TS one, so no v9 behaviour was described. -> done
- Docs check in the gate, proved to bite -> tests/check-docs.test.mjs (7 tests; failed 4 with the script stubbed, pass 7 with it). check-links already covered relative links; broke one link in README once and saw FAIL, then reverted; same for "make nope". -> done
- No gate case -> already held (Makefile has make check), README says what it runs -> already held
- Gate from clean clone -> make check -> done (160 tests pass)
## Files outside my area
none. tests/ and scripts/ hold the new docs check as the brief allows.
## Goldens changed
none. Conflict: tests/scaffold.test.mjs pins the heading "How to add a skill" and the line "Book a call at kaas.team" in README, so both were kept although the brief says no marketing. Owner should decide whether to unpin. check-structure also bans the word KaaS in README, so the clone URL and factory repo name were left out.
## Gate evidence
1..160
# tests 160
# suites 0
# pass 160
# fail 0
# cancelled 0
# skipped 0
# todo 0
## Learnings
- Running upgrade-pins with --help does a real network bump and rewrites vendored files; I reverted it with git checkout. Make it reject unknown flags.
- Existing tests pin README text and the identity check bans the org name, so a README rewrite needs those read first.
- npx of a local tarball fails by hand in the sandbox but passes in the package test.
