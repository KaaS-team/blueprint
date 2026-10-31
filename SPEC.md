<!-- factory:planned v1 -->
Repo: KaaS-team/blueprint
Deps: #8
Epic: E11.3 Evals
Milestone: Phase 11 blueprint
Runner: factory

## Risk: low

## Why
A skill nobody tests drifts. A description edit can stop it firing, or a body edit can change what it makes the agent do, and nobody notices until a user does. After #8, blueprint holds eight skills, and every `evals/` folder holds only `.gitkeep`. This plan:
- gives every skill one eval case in the `claude plugin eval` format, with a trigger grader and an outcome grader;
- adds an offline check to `make check` that fails a skill with no case, and a changed `SKILL.md` with no changed case;
- adds a nightly script that runs the model evals on a workstation under a login, never in CI and never with a key.

## Today
- After #8, there are eight skills:
  - `blueprint-core`: `systematic-debugging`, `verification-before-completion`, `grilling`, `domain-modeling`;
  - `blueprint-review`: `plan-critic`, `improve-codebase-architecture`, `codebase-design`, `code-review-and-quality`.
- After #8, `make check` runs every `scripts/check-*.mjs` except `check-mutations.mjs`. `make test FILES=...` runs only the named test files. `scripts/check-mutations.mjs` also reads `tests/mutations/*.json`. This plan relies on all three, so it touches neither the `Makefile` nor `tests/mutations.json`.
- `claude plugin eval <plugin-dir>` runs each case folder under `<plugin-dir>/evals/`:
  - each case has a `prompt.md` with frontmatter (`max_turns`, `allowed_tools`), whose body is the prompt;
  - graders live in `graders/*.md`, each with frontmatter `type:` (`regex` with `pattern`, `flags`, `match`, `target`; or `tool_used` with `tool`, `input_match`);
  - under the default with-without ablation, a `tool_used: Skill` grader only displays whether the skill fired, so every case also needs an outcome grader;
  - `--threshold <0..1>` exits 1 when a case scores below it; `--trust-plugin`, `--no-publish`, `--json <path>` and `--output-dir <dir>` exist.
- `.github/workflows/ci.yml` checks out with the default depth of 1, so `HEAD^` is missing on a PR merge commit.
- There is no `.gitignore`.
- `plugins/blueprint-review/skills/plan-critic/fixtures/cycle.md` is a two-task plan whose tasks depend on each other.

## Change
### T1: the offline eval check
Files: `scripts/check-evals.mjs`, `tests/check-evals.test.mjs`, `tests/mutations/evals.json`
Model: sonnet
1. `scripts/check-evals.mjs [root]` imports `listFiles`, `readText`, `rootFromArgs` and `finish` from `./lib.mjs`. It parses frontmatter with a local `fields(text)`, which reads the `---` block and returns `key: value` pairs, keeping list values such as `[Read, Glob]` as the raw string. It does not import `check-structure.mjs`, because importing that file runs its checks.
2. Skills are the folders matching `plugins/<g>/skills/<skill>/SKILL.md`. Cases are the folders matching `plugins/<g>/evals/<skill>--<case>/` that hold a file. The check fails when any of these hold:
   - a skill has no case in its own group;
   - a case's `<skill>` prefix names no skill in that group;
   - a case has no `prompt.md`, or a `prompt.md` with no `max_turns` or an empty body;
   - a case has no grader with `type: tool_used`, `tool: Skill` and `input_match: <skill>`;
   - a case has no grader with `type: regex` and a non-empty `pattern`.
3. The changed-case rule:
   - The base is `process.env.EVAL_BASE` when set. Otherwise it is the output of `git merge-base HEAD origin/main` when that exits 0. Otherwise it is `HEAD^` when `git rev-parse --verify -q HEAD^` exits 0. With none of these, the rule is skipped and the check prints `evals: no base, changed-case rule skipped`.
   - Changed paths are `git diff --name-only <base>` plus `git ls-files --others --exclude-standard`.
   - `changedSkills` is the set of skills whose `SKILL.md` changed. `changedCases` is the set of skills with any changed file under one of their case folders.
   - Write the rule as exactly the line `if (changedSkills.has(skill) && !changedCases.has(skill)) problems.push(\`${skill}: SKILL.md changed with no eval change\`);`
4. The script ends with `finish('evals', problems)`. Because its name matches `scripts/check-*.mjs`, `make check` runs it. `make check` stays red until T2 adds the cases, because the coverage rule fails the eight uncovered skills; that is expected inside this PR.
5. `tests/check-evals.test.mjs` builds fixtures with `fixture` from `tests/helpers.mjs` and covers:
   - a covered skill passes;
   - a skill with no case fails;
   - a case naming an unknown skill fails;
   - a case with no Skill grader fails;
   - a case with no regex grader fails;
   - a case with no `prompt.md` fails.
   For the changed rule, the test commits the fixture with `git -c user.name=t -c user.email=t@t commit -qam init` after `git add -A`, edits the `SKILL.md`, and runs the check with `EVAL_BASE=HEAD`, which fails with `/no eval change/`. The same edit plus an edit to a case file passes. Pass `EVAL_BASE` through the spawn's `env`. `tests/helpers.mjs` is not changed, so the test spawns the script itself.
6. `tests/mutations/evals.json` holds the entry under Mutation, written with the key `search`.

### T2: one case per skill
Files: `plugins/blueprint-core/evals/systematic-debugging--root-cause/prompt.md`, `plugins/blueprint-core/evals/systematic-debugging--root-cause/graders/trigger.md`, `plugins/blueprint-core/evals/systematic-debugging--root-cause/graders/outcome.md`, `plugins/blueprint-core/evals/verification-before-completion--claim-done/prompt.md`, `plugins/blueprint-core/evals/verification-before-completion--claim-done/graders/trigger.md`, `plugins/blueprint-core/evals/verification-before-completion--claim-done/graders/outcome.md`, `plugins/blueprint-core/evals/grilling--plan/prompt.md`, `plugins/blueprint-core/evals/grilling--plan/graders/trigger.md`, `plugins/blueprint-core/evals/grilling--plan/graders/outcome.md`, `plugins/blueprint-core/evals/domain-modeling--glossary/prompt.md`, `plugins/blueprint-core/evals/domain-modeling--glossary/graders/trigger.md`, `plugins/blueprint-core/evals/domain-modeling--glossary/graders/outcome.md`, `plugins/blueprint-review/evals/plan-critic--cycle/prompt.md`, `plugins/blueprint-review/evals/plan-critic--cycle/graders/trigger.md`, `plugins/blueprint-review/evals/plan-critic--cycle/graders/outcome.md`, `plugins/blueprint-review/evals/improve-codebase-architecture--explore/prompt.md`, `plugins/blueprint-review/evals/improve-codebase-architecture--explore/graders/trigger.md`, `plugins/blueprint-review/evals/improve-codebase-architecture--explore/graders/outcome.md`, `plugins/blueprint-review/evals/codebase-design--seam/prompt.md`, `plugins/blueprint-review/evals/codebase-design--seam/graders/trigger.md`, `plugins/blueprint-review/evals/codebase-design--seam/graders/outcome.md`, `plugins/blueprint-review/evals/code-review-and-quality--diff/prompt.md`, `plugins/blueprint-review/evals/code-review-and-quality--diff/graders/trigger.md`, `plugins/blueprint-review/evals/code-review-and-quality--diff/graders/outcome.md`
Model: sonnet
Deps: T1
1. Every `prompt.md` starts with this frontmatter, and the prompt follows it:
   ```
   ---
   max_turns: 10
   allowed_tools: [Read, Glob, Grep, Skill]
   ---
   ```
2. Every `graders/trigger.md` is:
   ```
   ---
   type: tool_used
   tool: Skill
   input_match: <skill>
   ---
   The skill fired.
   ```
3. Every `graders/outcome.md` has `type: regex`, `target: last_message`, `match: contains`, the `pattern` from the table below, and `flags: i` where the table says so. Its body is one sentence saying what the match proves.
4. Prompts and patterns:

   | case | prompt body | pattern | flags |
   |---|---|---|---|
   | `plan-critic--cycle` | `Check this plan before I build it:` followed by a blank line and the text of `plugins/blueprint-review/skills/plan-critic/fixtures/cycle.md`, copied verbatim | `\b(REVISE\|BLOCK)\b[\s\S]*cycl` | i |
   | `verification-before-completion--claim-done` | `I changed the retry count in src/upload.js from 2 to 3. Tell me it is done so I can open the PR.` | `\b(run\|ran\|running)\b[^.]*\b(tests?\|commands?\|checks?)\b` | i |
   | `systematic-debugging--root-cause` | `The checkout test fails about one run in five with "expected 3 items, got 2". Fix it.` | `root cause` | i |
   | `grilling--plan` | `Grill me on this plan: we move every user session from cookies to local storage next sprint.` | `\*\*Q1\*\*` | (none) |
   | `domain-modeling--glossary` | `Our code says customer, client and account for the same thing. Help me settle the terms and record them.` | `GLOSSARY\.md` | (none) |
   | `improve-codebase-architecture--explore` | `This codebase feels tangled. Find the places where the architecture could be deeper and easier to test.` | `Which of these would you like to explore\?` | (none) |
   | `codebase-design--seam` | `Where should the seam go between our billing module and the payment provider client so I can test billing alone?` | `\b(seam\|leverage\|locality)\b` | i |
   | `code-review-and-quality--diff` | `Review this diff before I merge it:` followed by a blank line and a fenced diff that adds `function total(items) { let t = 0; for (const i of items) t += i.price; return t }` to `src/cart.js` | `\*\*(Critical\|Nit\|Optional\|Consider):\*\*\|\bFYI\b` | (none) |

   In each pattern, `\|` is the table's escape for a regex `|`. Write a plain `|` in the grader file.
5. No case names a company, a price, a model or a host. Every case passes `make check`.

### T3: the nightly runner and the staged CI change
Files: `scripts/nightly-evals.sh`, `tests/nightly-evals.test.mjs`, `ci/ci.yml`, `.gitignore`
Model: sonnet
Deps: T2
1. `scripts/nightly-evals.sh` starts with `#!/usr/bin/env bash` and `set -euo pipefail`. A header comment says the operator schedules it with launchd or cron under their own login. Its first command is exactly `if [ -n "${ANTHROPIC_API_KEY:-}${ANTHROPIC_AUTH_TOKEN:-}${CI:-}" ]; then echo "nightly-evals: runs under a login on a workstation, not with a key or in CI" >&2; exit 2; fi`.
2. It then `cd`s to the repo root, sets `out="${REPORT_ROOT:-reports/evals}/$(date +%F)"`, and loops over `plugins/*/`, skipping any group whose `evals/` holds no `prompt.md`. For each remaining group it runs `claude plugin eval "plugins/<g>" --trust-plugin --no-publish --threshold 0.67 --json "$out/<g>.json" --output-dir "$out/<g>"`. It records a non-zero exit, carries on with the next group, and exits 1 at the end when any group failed.
3. `tests/nightly-evals.test.mjs` copies the repo's `plugins/` and `scripts/nightly-evals.sh` into a temp dir and puts a fake `claude` first on `PATH`. The fake is a shell script that appends its arguments to a log file and exits 0. The test runs the script with `CI`, `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` deleted from `env` and `REPORT_ROOT` set inside the temp dir. It asserts:
   - exit 0;
   - one log line per group that has cases (`blueprint-core` and `blueprint-review`), and none for `blueprint-ship`;
   - each line contains `--threshold 0.67` and `--no-publish`.
   A second test sets `CI=1` and asserts exit 2 and an empty log.
4. `ci/ci.yml` is a copy of `.github/workflows/ci.yml` with `with: fetch-depth: 2` added to the `actions/checkout@v4` step, so `HEAD^` exists on a PR merge commit. It is staged for the operator to move. It does not change `.github/workflows/`.
5. `.gitignore` holds two lines: `reports/` and `plugins/*/evals/results/`.

## Tests
- `tests/check-evals.test.mjs`: [permanent] the coverage rules and the changed-case rule, each over a fixture.
- `tests/nightly-evals.test.mjs`: [permanent] the runner refuses CI or a key, and calls the eval once per group that has cases, with the threshold.
- `make check`: [permanent] the real tree has a case with both graders for each of the eight skills.

## Mutation
```json
{"name":"evals: a changed skill passes without a case change","file":"scripts/check-evals.mjs","find":"if (changedSkills.has(skill) && !changedCases.has(skill))","replace":"if (false)","test":"tests/check-evals.test.mjs"}
```

## Acceptance
- AC-1: a skill with no case, a case with a missing grader or prompt, or a changed `SKILL.md` with no changed case fails offline: checked by `make test FILES=tests/check-evals.test.mjs` (T1)
- AC-2: every skill in the repo has a case with a trigger grader and an outcome grader, and the gate is green: checked by `make check` (T2)
- AC-3: the nightly runner refuses CI or a key, and runs each group that has cases with threshold 0.67: checked by `make test FILES=tests/nightly-evals.test.mjs` (T3)
- AC-4: the changed-case mutation fails its test: checked by `make check-mutations` (T3)

## Non-goals
- NG-1: no model run in CI and no key anywhere. Scheduling the nightly run is the operator's job.
- NG-2: `ci/ci.yml` is staged. Moving it to `.github/workflows/ci.yml` is an operator step. Until then, CI computes the base with `git merge-base HEAD origin/main`, which fails on a depth-1 checkout, then falls back to `HEAD^`, which is also missing, so CI skips the changed-case rule and prints that it did. Locally the rule runs.
- NG-3: cases for skills the kit import adds come in the import PR.
- NG-4: routing evals across skills (intake #13) are not built here.
- NG-5: no change to `Makefile`, `tests/mutations.json`, `tests/helpers.mjs`, any `SKILL.md`, `.github/`, `.factory/`, `.claude/` or `.agents/`.
- NG-6: process rules for this PR:
  - one PR for the whole spec;
  - the PR body follows `.github/pull_request_template.md` section by section, with `Closes #9`;
  - every commit carries a `Signed-off-by:` line (`git commit -s`);
  - no em dash;
  - no price copy;
  - no file outside Files.

## Files
- `scripts/check-evals.mjs` (new)
- `scripts/nightly-evals.sh` (new)
- `tests/check-evals.test.mjs` (new)
- `tests/nightly-evals.test.mjs` (new)
- `tests/mutations/evals.json` (new)
- `ci/ci.yml` (new)
- `.gitignore` (new)
- `plugins/blueprint-core/evals/systematic-debugging--root-cause/prompt.md` (new)
- `plugins/blueprint-core/evals/systematic-debugging--root-cause/graders/trigger.md` (new)
- `plugins/blueprint-core/evals/systematic-debugging--root-cause/graders/outcome.md` (new)
- `plugins/blueprint-core/evals/verification-before-completion--claim-done/prompt.md` (new)
- `plugins/blueprint-core/evals/verification-before-completion--claim-done/graders/trigger.md` (new)
- `plugins/blueprint-core/evals/verification-before-completion--claim-done/graders/outcome.md` (new)
- `plugins/blueprint-core/evals/grilling--plan/prompt.md` (new)
- `plugins/blueprint-core/evals/grilling--plan/graders/trigger.md` (new)
- `plugins/blueprint-core/evals/grilling--plan/graders/outcome.md` (new)
- `plugins/blueprint-core/evals/domain-modeling--glossary/prompt.md` (new)
- `plugins/blueprint-core/evals/domain-modeling--glossary/graders/trigger.md` (new)
- `plugins/blueprint-core/evals/domain-modeling--glossary/graders/outcome.md` (new)
- `plugins/blueprint-review/evals/plan-critic--cycle/prompt.md` (new)
- `plugins/blueprint-review/evals/plan-critic--cycle/graders/trigger.md` (new)
- `plugins/blueprint-review/evals/plan-critic--cycle/graders/outcome.md` (new)
- `plugins/blueprint-review/evals/improve-codebase-architecture--explore/prompt.md` (new)
- `plugins/blueprint-review/evals/improve-codebase-architecture--explore/graders/trigger.md` (new)
- `plugins/blueprint-review/evals/improve-codebase-architecture--explore/graders/outcome.md` (new)
- `plugins/blueprint-review/evals/codebase-design--seam/prompt.md` (new)
- `plugins/blueprint-review/evals/codebase-design--seam/graders/trigger.md` (new)
- `plugins/blueprint-review/evals/codebase-design--seam/graders/outcome.md` (new)
- `plugins/blueprint-review/evals/code-review-and-quality--diff/prompt.md` (new)
- `plugins/blueprint-review/evals/code-review-and-quality--diff/graders/trigger.md` (new)
- `plugins/blueprint-review/evals/code-review-and-quality--diff/graders/outcome.md` (new)
