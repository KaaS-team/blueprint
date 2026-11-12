You are one of six agents working in parallel. You work alone in KaaS-team/blueprint; the others are in other repos.

## Why

Blueprint is the catalogue of skills the factory pulls by reference, and its plugin is how a Claude Code user meets KaaS before installing anything. Today nothing runs after install, the pins are stale, and nothing proves a newer upstream is better. This ticket adds a first-run skill that produces a result in the first hour, and an upgrade path that bumps a pin only when the evals say it is not worse.

## Setup

`git fetch origin && git checkout -b cluster/blueprint-wow origin/cluster/blueprint-v0.2-skills`. That branch is one commit ahead of `main` (agents verifier, gate-triage, complexity-surgeon and two rules) and is your base. The gate is `make check`; also run `node scripts/check-vendor.mjs`, `node scripts/check-evals.mjs` and `node scripts/check-routing.mjs`, which must stay green.

Your file area: `plugins/`, `routing/`, `scripts/`, `tests/`, `bin/`, `package.json`, `upstreams.json`, `README.md`.

The private kit is not reachable from this sandbox. `scripts/import-kit.mjs` stays as it is; the supervisor runs the kit import locally.

## Acceptance

- [ ] A `first-run` skill in the review plugin (or a new `blueprint-first-run` plugin if the structure check prefers it) walks: run `auditor audit --gh` on the repo (or say how to install it), show the top 3 risks, pick the one lowest-risk high-value finding, run plan-critic on a plan for it, build test-first, verify in a fresh subagent with verification-before-completion and code-review-and-quality, run the repo's gate, open one draft PR, then `auditor reaudit`. Its description passes `check-routing` (top-1 for at least three first-run prompts you add to the routing set).
- [ ] An eval for `first-run` in the same shape as `plan-critic--cycle` (prompt plus trigger and outcome graders) on a small fixture repo under the skill's `fixtures/`; `check-evals` passes.
- [ ] `scripts/upgrade-pins.mjs`: for each pin in `upstreams.json`, fetch the upstream file at HEAD (through `git ls-remote` and a raw fetch, injectable for tests), and when it differs, write the new sha and sha256 only if the offline checks (`check-vendor`, `check-evals`, `check-routing`) still pass with the new content; otherwise leave the pin and print why. `--dry-run` prints the plan. Tests use a local bare git repo as the upstream.
- [ ] Run `upgrade-pins` for real against the three upstreams (obra/superpowers, mattpocock/skills, addyosmani/agent-skills); commit the pins it bumps and the vendored content, and list in the report which pins moved and which were held and why.
- [ ] `package.json` drops `private: true`; `npm pack` then `npx ./kaas-blueprint-*.tgz --help` prints usage (test it in `tests/`).
- [ ] plan-critic is the one plan rubric: its SKILL.md says it is the rubric the factory's `factory-plan-rubric` points to, and a test fails if a second plan rubric skill appears in this repo.

## Order of work, for each acceptance line

1. Check whether it already holds. If it does, change no code and record the evidence.
2. Write a test that fails, then the code that makes it pass. Revert the fix once and watch the test fail.
3. Run the repo's gate (`make check`) before every push. Commit with `git commit -s`, one commit per acceptance group, and push after each so a dropped session loses little.

## Checkpoints, before every commit

1. Area: every changed file is in your area or listed under "Files outside my area".
2. Scope: the diff serves only an acceptance line below.
3. Meaning: each acceptance line still means what it says; if it cannot be met, record it blocked, never weaken it.
4. Proof: you saw each new test fail before the fix and pass after.
5. Pins: you raised no cap, baseline or golden just to make a test pass; any golden you update is named in the report with the reason.
6. Forbidden paths: nothing under `.github/`, `.factory/`, `.claude/`, `.agents/`; no version or changelog edit.

## Rules

- No network, real token or model call in any test. Use fixtures and fake executables on `PATH`.
- No `ANTHROPIC_*` or other provider key anywhere.
- This repo may become public. Name no customer. No model name, token count or cost in customer-facing output except where an acceptance line asks for an estimate in the operator report.
- No em dashes in prose. Plain sentences. Never write a claim the code does not do.
- Do not comment on, label or close issues, and do not open a PR. Never force-push or push to `main`.
- No session URL, `claude.ai` link or `Claude-Session:` trailer in any commit or file.
- If one line is blocked, record why and continue.

## When you finish

Write the report below to a file outside the repo, then push it:

```
b=$(git hash-object -w /tmp/report.md); t=$(printf '100644 blob %s\treport.md\n' "$b" | git mktree); c=$(git commit-tree "$t" -m report); git push origin "$c:refs/heads/report/v9-blueprint-wow"
```

Your final message is that same report, exactly:

```
BRANCH: cluster/blueprint-wow
HEAD: <full sha you pushed, checked with git ls-remote>
## Summary
<one or two sentences>
## Acceptance
- <line> -> <test name> -> done | already held | blocked (why)
## Files outside my area
<each, with why, or none>
## Goldens changed
<each, with why, or none>
## Gate evidence
<last lines of `make check`, verbatim>
## Learnings
<what cost time; what the defaults should do instead. One line each.>
```
