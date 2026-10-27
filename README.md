# blueprint

Open engineering skills, agents and hooks for coding-agent teams.

## Layout

Three plugin groups live under `plugins/`: `blueprint-core`, `blueprint-review` and `blueprint-ship`.
Each has `skills/`, `agents/`, `rules/` and `evals/` folders.

## How to add a skill

1. Create `plugins/<group>/skills/<name>/SKILL.md`, where `<name>` is the folder name.
2. Set the frontmatter `name` to the same `<name>`.
3. Write a `description` of at most 1024 characters that contains "Use when".
4. Run `make check` and fix anything it reports.

## Checks

`make check` runs the structure, prose and link checks, then the node tests. It needs only Node and make.
`make check-mutations` breaks each check on purpose and confirms that its test fails.

Book a call at kaas.team
