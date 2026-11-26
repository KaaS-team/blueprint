---
name: rollout-check
description: Use when a team has just run the team rollout, or you suspect a repo is missing its shared agent setup. Checks AGENTS.md, per-agent pointers, settings, hooks and rules are present and report each gap with the command that fixes it.
---

# rollout-check

Checks a repo against what `kaas-blueprint init --team` writes. It only reads.

## Steps

1. **Dry run.** Run `kaas-blueprint init --team --dry-run` in the repo root. Every file it would write is a gap. If it prints `nothing to change`, the setup is complete.
2. **Hooks.** Check the secrets guard hook and the stop hook that runs the gate exist and are executable.
3. **Rules.** Check the three rules files are in place: gate before done, secrets and small changes.
4. **Report.** List each gap as a file path and the fix. The fix is `kaas-blueprint init --team`, run once.
5. **Stop.** Do not edit files. Let the person decide to run the fix.

## Ground rules

- Never overwrite a file the team has edited.
- Say plainly when nothing is missing.
