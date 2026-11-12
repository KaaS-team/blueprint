You are one of twenty agents working in parallel. You work alone in KaaS-team/blueprint; the others are in other repos.

## Why

Blueprint copies upstream skills into itself. The factory now pulls packs by reference through `factory.lock` (`repo@sha#path`, licence, sha256). Blueprint should become the catalogue those references come from: a curated list with tags and scores. Copies stay only for the plugin marketplace, generated from the list.

## Setup

`git fetch origin && git checkout -b cluster/blueprint-catalogue origin/main`. The gate is `make check`; `check-vendor`, `check-evals` and `check-routing` must stay green. Main accepts changes only by PR; push your branch and the supervisor opens it.

Your file area: `catalogue/` (new), `upstreams.json`, `scripts/`, `tests/`, `README.md`, `package.json`.

## Acceptance

- [ ] `catalogue/catalogue.json`: one entry per pack with `id`, `kind` (skill, agent, workflow, check), `source` (`repo@sha#path`), `licence`, `sha256`, `tags`, and `eval` (the eval file that scores it, or null). It covers every entry in `upstreams.json` plus the KaaS-own skills. A test checks it against `upstreams.json` both ways.
- [ ] `scripts/build-plugin.mjs` regenerates the vendored plugin copies from the catalogue; running it on a clean tree changes nothing (test).
- [ ] `upgrade-pins` pairs each bump with an eval edit: when a SKILL.md changes, it updates that skill's eval file hash in the same change so `check-evals` passes (the follow-up from the last run). Test with a local fake upstream.
- [ ] Licence check: an entry whose licence is not MIT or Apache-2.0 fails the catalogue test.
- [ ] README gains a "Catalogue" section under 20 lines saying how the factory reads it.

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
b=$(git hash-object -w /tmp/report.md); t=$(printf '100644 blob %s\treport.md\n' "$b" | git mktree); c=$(git commit-tree "$t" -m report); git push origin "$c:refs/heads/report/v9-blueprint-catalogue"
```

Your final message is that same report, exactly:

```
BRANCH: cluster/blueprint-catalogue
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
