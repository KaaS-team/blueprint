---
name: ship
description: Use when a finished change must go from your branch to a reviewable pull request. Runs the repo gate, checks the diff is small and on topic, writes the PR body from the evidence and opens one pull request. Never merges.
---

# ship

Turns a finished branch into one pull request with proof attached.
Do the steps in order and stop at the first step that fails.

## Steps

1. **Gate.** Run the repo's own gate, the command its README or Makefile names (for example `make check`). Quote the last lines of the output. If it fails, stop and report the failure.
2. **Diff.** Read `git diff origin/main...HEAD --stat`. Say what changed in one sentence. If the diff touches files unrelated to that sentence, stop and ask for them to be split out.
3. **Rebase.** Run `git fetch origin main` and `git rebase origin/main`. Re-run the gate if the rebase moved anything.
4. **Body.** Use the repo's PR template if one exists. Put in the change, the reason, the gate lines and anything left undone. Write plain sentences and leave out filler.
5. **Open.** Push the branch and open exactly one pull request. Never open a second one for the same branch.
6. **Stop.** Report the PR link. Do not merge and do not approve it.

## Ground rules

- Never push to the default branch.
- Never skip or disable a test to get a green gate.
- Quote real command output. Do not paraphrase it.
