---
name: first-run
description: Use when you are new to this repo or just installed blueprint and want a first result in the first hour. Audits the repo with auditor, shows the top three risks, fixes the safest valuable one test-first, verifies it in a fresh subagent, opens one draft PR, then reaudits.
---

# first-run

A guided first hour. It ends with one small draft PR and a before and after audit.
Do the steps in order and stop at the first step that fails.

## Steps

1. **Audit.** Run `auditor audit --gh` in the repo root. If `auditor` is not on
   the PATH, say so, tell the user to install the auditor CLI first, and stop.
   Do not guess an install command or a package name.
2. **Top 3 risks.** Show the three highest risks from the audit, each with its
   file, what could go wrong and how sure the audit is.
3. **Pick one.** Choose the single finding with the lowest risk of change and
   the highest value, meaning a small fix in a few files that a test can prove.
   Say why you picked it and why you passed on the other two.
4. **Plan and critique.** Write a plan for that one finding in the plan-critic
   format and run the plan-critic skill on it. Revise once if it says REVISE. If
   it says BLOCK, stop and report why.
5. **Build test-first.** Write a test that fails for the finding. Run it and
   watch it fail. Make the smallest change that fixes it. Run it and watch it pass.
6. **Verify in a fresh subagent.** Start a subagent that has not seen your
   work. Give it the diff, the plan and the two skills
   verification-before-completion and code-review-and-quality. It reports pass or
   findings. Fix findings and verify again.
7. **Gate.** Run the repo's own gate, the command its README or Makefile names
   (for example `make check` or `npm test`). Quote the last lines of the output.
   If it fails and the failure is not yours, stop and report it.
8. **One draft PR.** Open exactly one draft pull request for the change. Put the
   finding, the plan, the failing then passing test and the gate lines in the
   description. Never merge it and never open a second one.
9. **Reaudit.** Run `auditor reaudit` and report which findings went away and
   which remain. Say plainly if nothing changed.

## Ground rules

- Touch only the files the plan lists. Anything else is a new finding to report.
- Do not skip a step because the change looks small.
- Report what happened. If a step did not run, say that it did not.

## Try it on the sample repo

`fixtures/repo` is a small repo with one clear finding: a retry helper that
never gives up. It is for the eval and for dry runs of this walk.
