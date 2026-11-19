# One command, same setup for every agent

This is a real run on a temp repo. The repo already has a `CLAUDE.md`.

## Before

```
$ find . -not -path './.git*' | sort
CLAUDE.md
package.json
```

## Preview

```
$ kaas-blueprint init --team --dry-run
would create AGENTS.md
would update CLAUDE.md
would create .claude/settings.json
would create .claude/blueprint-ship/hooks/guard-secrets.mjs
would create .claude/blueprint-ship/hooks/stop-gate.mjs
would create .cursor/rules/kaas-blueprint.mdc
would create .gemini/settings.json
```

## Run

```
$ kaas-blueprint init --team
create AGENTS.md
update CLAUDE.md
create .claude/settings.json
create .claude/blueprint-ship/hooks/guard-secrets.mjs
create .claude/blueprint-ship/hooks/stop-gate.mjs
create .cursor/rules/kaas-blueprint.mdc
create .gemini/settings.json
```

## After

```
$ find . -not -path './.git*' | sort
.claude
.claude/blueprint-ship
.claude/blueprint-ship/hooks
.claude/blueprint-ship/hooks/guard-secrets.mjs
.claude/blueprint-ship/hooks/stop-gate.mjs
.claude/settings.json
.cursor
.cursor/rules
.cursor/rules/kaas-blueprint.mdc
.gemini
.gemini/settings.json
AGENTS.md
CLAUDE.md
package.json
$ cat CLAUDE.md
# Acme API

Use tabs.

@AGENTS.md
```

## Run it again

A second run changes nothing.

```
$ kaas-blueprint init --team
nothing to change
```

## What each agent reads

| Agent | Reads |
|---|---|
| Claude Code | `CLAUDE.md` (points to `AGENTS.md`) and `.claude/settings.json` with the secret guard and stop gate hooks |
| Cursor | `.cursor/rules/kaas-blueprint.mdc` |
| Codex | `AGENTS.md` |
| Gemini CLI | `AGENTS.md`, set through `.gemini/settings.json` |

Use `--agents claude,cursor` to pick targets. Your own text in `AGENTS.md` and `CLAUDE.md` is kept. The rules live between two marker comments and are replaced on each run.
