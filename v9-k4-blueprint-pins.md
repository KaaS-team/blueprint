You are one of about 46 agents working in parallel. You are the only one on this ticket in KaaS-team/blueprint.

## Ticket: pins upgraded by eval

All three upstreams moved since the pins in `upstreams.json`. Write or finish `scripts/upgrade-pins` that, per pin, fetches upstream
HEAD, runs the offline evals (`check-evals`, `check-routing`) with old and new, and writes the bump only when nothing gets worse. Run it
once, commit the bumps that pass, and list the ones that did not with the reason. Make `make check` run its unit test.

## Setup and rules

`git fetch -q origin && git checkout -b cluster/k4-blueprint-pins origin/main`. Read `AGENTS.md` or `README.md`, then the Makefile. Gate: `make check`,
run before every push, chained with `&&`. Commit with `git commit -s`, push to `cluster/k4-blueprint-pins` after each commit. Never push to
`main`, never force-push, never open a PR or comment on issues. No em dashes. No session URL or `claude.ai` link in any file or commit.
A new check is wired into the gate in the same commit. Prefer deleting to adding.

## When you finish

```
b=$(git hash-object -w /tmp/report.md); t=$(printf '100644 blob %s\treport.md\n' "$b" | git mktree); c=$(git commit-tree "$t" -m report); git push origin "$c:refs/heads/report/v9-k4-blueprint-pins"
```

Report (also your final message):

```
BRANCH: cluster/k4-blueprint-pins
HEAD: <full sha>
## Summary
## Acceptance
- <line> -> <test or check> -> done | blocked (why)
## Size
<tracked lines before and after>
## Gate evidence
## Learnings
```
