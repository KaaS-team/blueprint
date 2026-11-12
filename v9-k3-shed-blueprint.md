You are one of 10 agents working in parallel. You are the only one in KaaS-team/blueprint.

## Ticket: shed blueprint: keep only what is needed

KaaS-team/blueprint (Node scripts plus skills and plugins) grew over several waves of parallel sessions. Make it the smallest repo that still does its job.

## Setup

`git fetch -q origin && git checkout -b cluster/shed-blueprint origin/main`. Read `AGENTS.md` or `README.md` first, then the Makefile. The
gate is `make check`; run it before every push and chain gate and push with `&&`.

## What to remove

1. Files nothing uses: scripts no recipe, CI job, test or doc calls; fixtures no test reads; generated output that is committed and
   also regenerated; stale copies of files that live elsewhere (another repo or another directory here).
2. Functions, rules, sections or modules nothing reaches. Use the language's own tool where one exists (Rust: `cargo +stable clippy`
   warnings and `#[allow(dead_code)]` sites; Node: unused exports by grep; Python: `vulture` if it installs, otherwise grep).
3. Docs longer than what they govern, docs that repeat another doc, and any line that claims what the code does not do. Fix the claim
   or delete the line.
4. Duplicates: two scripts or modules doing one job become one.

## What to keep

Anything the gate, CI, a public install path, a plugin manifest or a customer-facing doc needs. Any behaviour a test pins. When unsure,
keep it and list it under "Kept, unsure" with why.

## Rules

- No behaviour change on paths that are used; delete a test only together with what it tests.
- One commit per kind of removal, `git commit -s`, push to `cluster/shed-blueprint` after each. Never push to `main`, never force-push,
  never open a PR, never comment on issues.
- No em dashes in prose. No session URL or `claude.ai` link in any commit or file.

## When you finish

Write the report to /tmp/report.md, then push it to its own branch:

```
b=$(git hash-object -w /tmp/report.md); t=$(printf '100644 blob %s\treport.md\n' "$b" | git mktree); c=$(git commit-tree "$t" -m report); git push origin "$c:refs/heads/report/v9-k3-shed-blueprint"
```

Your final message is then that same report:

```
BRANCH: cluster/shed-blueprint
HEAD: <full sha you pushed>
## Summary
<one or two sentences>
## Removed
<path or symbol, lines, why, grouped by kind>
## Kept, unsure
<each with why, or none>
## Size
<tracked lines before and after: git ls-files | xargs wc -l | tail -1>
## Gate evidence
<last lines of the gate, verbatim>
## Learnings
<one line each>
```
