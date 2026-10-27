---
name: plan-critic
description: Use when a plan, meaning a list of tasks with sizes, dependencies and verify lines, must be checked before it is built. Runs a deterministic script first, then a 0 to 2 rubric, and returns PASS, REVISE or BLOCK.
---

# plan-critic

Checks a plan in two steps. The script finds structural faults. The rubric
judges the plan's content. Run them in this order: the rubric is only worth
scoring once the script passes.

## Plan format

A plan is a Markdown file with one heading per task, then `- key: value` lines:

```
## T1: Add the retry helper
- size: S
- depends: none
- files: src/retry.mjs (new), src/upload.mjs
- verify: a unit test shows a failed upload is retried twice
```

- `## T<n>: <title>` starts a task. Ids are `T1`, `T2`, and so on.
- `size` is `S`, `M` or `L`.
- `depends` is a comma-separated list of task ids, or `none`.
- `files` is a comma-separated list. Each path must exist relative to the
  working directory, or end with ` (new)` when the task creates it.
- `verify` names the test or acceptance criterion that proves the task.

## Run the script

```
node plugins/blueprint-review/skills/plan-critic/scripts/check-plan.mjs PLAN.md
```

Run it from the repo root, because `files` paths resolve against the working
directory. Other repos should point the command at the script's own path. It prints one JSON
object, `{ok, findings[]}`, and exits 0 when `ok` is true, 1 when it is false.
Each finding names its `task` (or `null` for a plan-wide line) and its `rule`:

| rule | fires when |
| --- | --- |
| `no-verify` | a task has no `verify` line |
| `no-size` | a task has no size of S, M or L |
| `unknown-dependency` | a task depends on a task id that does not exist |
| `cycle` | a task sits on a dependency cycle |
| `unknown-file` | a file is neither present nor marked `(new)` |
| `placeholder` | the plan contains `TBD`, `TODO`, `???` or `FIXME` |

If `ok` is false, fix every finding and run the script again before scoring.

## Rubric

Score each item 0, 1 or 2. Read the whole plan before you score.

1. **intent**: the plan covers what the request asked for.
2. **scope**: the plan stays inside the request. Work the request did not ask
   for scores 0.
3. **verification**: every task says how it is verified, not only some.
4. **risk**: the plan names its risk, such as data, security or a public API.
5. **estimate**: every task has a size, and the plan has a total.

Write the scores as a JSON object keyed by the five item names, for example
`{"intent": 2, "scope": 2, "verification": 2, "risk": 1, "estimate": 2}`.

## Verdict

Pass the script's findings and the scores to `verdict({findings, scores, round})`,
exported by `scripts/check-plan.mjs`, or apply the same rule by hand:

- **PASS** needs no script findings, every item at 1 or more, and a total of 8 or more.
- **REVISE** is any other result on round 1. Send the findings and the low items
  back to the plan's author, who revises once.
- **BLOCK** is any other result on round 2. Stop and report the plan as blocked.

There is at most one revise round. A second failure is BLOCK.
