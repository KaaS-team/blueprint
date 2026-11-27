---
name: repo-audit
description: "Score a repo against the engineering standard and list what is missing. Use when asked how a repo scores against the standard, or what it is missing."
argument-hint: "[repo path | all]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
disable-model-invocation: true
---

# repo-audit

Reports what a repo is missing against `${CLAUDE_PLUGIN_ROOT}/engineering.md`. It reports; it
does not refactor. Fixing what it names is separate, deliberate work.

## Step 0: read the standard

Read `${CLAUDE_PLUGIN_ROOT}/engineering.md` and the API and database tables in
`${CLAUDE_PLUGIN_ROOT}/rules/`. Every check below maps to a rule there, and the
report is only useful next to the rule that justifies it.

## Step 1: run the checker

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/audit-repo.py <repo-path>       # human readable
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/audit-repo.py <repo-path> --json # for further analysis
```

Exit code is 1 when anything FAILs. With `all`, run it across every repo under
`$WORKSPACE/` that contains a `package.json`, and print one summary line
each so the fleet is comparable in a single view.

## Step 2: verify before reporting

The checker is heuristic. Two findings need a look before you repeat them, because
both have produced false results already:

| Finding | What to check | Why |
|---|---|---|
| **notification claim** | Trace the specific path to the alerting call | The string is true in one app (failed set to ops-alerts to Telegram) and false in another app. Severity already reflects whether alerting exists at all, not whether this path reaches it |
| **LIMIT coverage** | Confirm the named files are production, and that the selects are not single-row lookups by primary key | Test files select without limits on purpose. Counting them once made one app look unbounded when 6 of 9 flagged files were tests |

Never report a finding you did not open the file for. A checker that cries wolf
gets ignored, and then the real findings go with it.

## Step 3: report

Lead with a status table, then the ordered list. Keep it inside one screen.

| Repo | Fail | Warn | Pass | Worst finding |
|---|---|---|---|---|

Rank by what a failure costs, not by check order. A silently public route outranks
a missing `renovate.json` every time.

## Adding a check

Only add one that would have caught a real failure, and name that failure in the
detail string. A check without a receipt is a check people will disable.

Every check must be falsifiable: run it against one app (which should pass) and
against the repo the finding came from (which should fail). If both pass, the check
is wrong.

---

## Success criteria

`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/audit-repo.py <repo>` runs to completion, and every finding is
either fixed, or written down with the reason it is being carried.

## Scope and limitations

Reports what is missing against `${CLAUDE_PLUGIN_ROOT}/engineering.md`. It does not fix anything, and
it is static: it cannot tell a bounded query from an unbounded one at run time, so a clean
report is the absence of the patterns it knows, not proof of correctness. A repo's own
`AGENTS.md` wins where it disagrees, but only if it says so out loud.
