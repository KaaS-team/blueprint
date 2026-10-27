# blueprint

Open engineering skills, agents and hooks for coding-agent teams.

## Layout

Three plugin groups live under `plugins/`: `blueprint-core`, `blueprint-review` and `blueprint-ship`.
Each has `skills/`, `agents/`, `rules/` and `evals/` folders.

## Install

`bin/blueprint.mjs` copies skills into your coding agent's skills folder. It needs only Node.

```sh
node bin/blueprint.mjs list                   # every skill and its group
node bin/blueprint.mjs list --json            # the same, as a JSON array
node bin/blueprint.mjs add <skill> <group>    # a skill name, or a group name (core, review, ship)
```

`add` flags:

- `--agent <name>`: `claude` (default), `codex`, `cursor`, `pi` or `agents`, which set the folder to `.claude/skills`, `.codex/skills`, `.cursor/skills`, `.pi/skills` or `.agents/skills`.
- `--global`: install under your home folder instead of the current folder.
- `--dir <path>`: install into exactly this folder. It overrides `--agent` and `--global`.
- `--force`: replace a skill folder that already exists. Without it, `add` refuses and copies nothing.

An unknown name exits with code 2 and suggests the nearest name.

## How to add a skill

1. Create `plugins/<group>/skills/<name>/SKILL.md`, where `<name>` is the folder name.
2. Set the frontmatter `name` to the same `<name>`.
3. Write a `description` of at most 1024 characters that contains "Use when".
4. Run `make check` and fix anything it reports.

## Checks

`make check` runs the structure, prose and link checks, then the node tests. It needs only Node and make.
`make check-mutations` breaks each check on purpose and confirms that its test fails.

Book a call at kaas.team
