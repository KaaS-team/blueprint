# Team rollout pack

A starting point for rolling Claude Code out to a team. It has managed settings, two hooks and three rules files.

## What is in it

| File | What it does |
|---|---|
| `managed-settings.json` | Allow and deny lists, two background-spend settings, and the two hook entries. It holds no provider key. |
| `hooks/guard-secrets.mjs` | Pre-tool hook. Exits 2 when a Read, Edit, Write, Grep, Glob or Bash call names a `.env*` file (not `.env.example`), a `secrets` folder, a `.pem` or `.key` file, an SSH key or a credentials file. It checks file names only. It does not read contents and it is not a sandbox. |
| `hooks/stop-gate.mjs` | Stop hook. Runs `make check` in the repo and exits 2 with the last 40 lines of output when it fails. It does nothing when the repo has no `check` target, and it lets a stop through that was already caused by a gate failure. Set `BLUEPRINT_GATE_CMD` to use another command. |
| `../rules/secrets.md` | Prevents a key from a `.env` file landing in a transcript or a commit. |
| `../rules/gate-before-done.md` | Prevents work reported as done while the repo check fails. |
| `../rules/small-changes.md` | Prevents one change too large to review. |

## Install

1. Copy the `hooks/` folder to `/etc/claude-code/blueprint-ship/hooks/` on each machine. The paths in `managed-settings.json` expect that place. Change them if you use another.
2. Put `managed-settings.json` where Claude Code reads managed settings on that operating system.
3. Copy the three rules files into the repos or the shared rules folder you use. Managed settings do not load rules files.

Node 22 or newer must be on the machine for the hooks.

## What was taken from the lean settings profile

Kept: `awaySummaryEnabled: false`, `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=0`, `CLAUDE_CODE_GLOB_NO_IGNORE=false`, and the denied reads of `node_modules`, `dist`, `.next`, `build` and `coverage`. In lean's own bench these lost no quality (27 of 27 tasks solved) but showed no measurable cost saving either. They are kept because they remove background activity and unread folders, not because a saving was shown.

Left out: `effortLevel: medium` and every opt-in lever (code-navigation plugins, cheaper models for subagents, MCP output proxies), which lean marks as unmeasured. Also left out: the compaction rule and the handoff hook, which have no result in the bench.
