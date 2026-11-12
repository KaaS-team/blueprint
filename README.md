# blueprint

blueprint is a catalogue of engineering skills, agents and rules for coding agents, packaged as three Claude Code plugins and a small installer.
Engineers use it to copy a skill into the skills folder of their coding agent, and the factory reads its catalogue to pick packs for a task.

## Install

You need Node 22 or newer, git and make. Nothing else is installed or fetched. Clone this repository, open the folder, and run the gate:

```sh
make check
```

`make check` runs every check script under `scripts/` and then the node tests. It ends with a line such as `# fail 0`.

## First command

List the skills the installer knows:

```sh
node bin/kaas-blueprint.mjs list
```

Output:

```
domain-modeling	core
grilling	core
systematic-debugging	core
verification-before-completion	core
code-review-and-quality	review
codebase-design	review
first-run	review
improve-codebase-architecture	review
plan-critic	review
```

Install one into the current folder's `.claude/skills`:

```sh
node bin/kaas-blueprint.mjs add plan-critic
```

It prints `added plan-critic to <folder>/.claude/skills/plan-critic`.

## Installer options

- `--agent <name>` picks the agent: `claude` (`.claude/skills`, the default), `codex` (`.codex/skills`), `cursor` (`.cursor/skills`), `pi` (`.pi/skills`) or `agents` (`.agents/skills`).
- Skills go into the current folder by default. `--global` uses your home folder instead, and `--dir <path>` uses exactly that folder. The two cannot be combined.
- `--force` replaces a skill folder that already exists. Without it an existing folder is refused and nothing is written.
- `list --json` prints the list as JSON.
- A group name installs every skill in that group. Groups are the plugin folder names without the `blueprint-` prefix: `core`, `review` and `ship`. `ship` has no skills yet.
- An unknown name exits with code 2 and suggests the nearest skill or group.

`node bin/kaas-blueprint.mjs --help` prints usage. `npm pack` makes a tarball, and `npx ./kaas-blueprint-*.tgz --help` runs the installer from it.

## Layout

- `plugins/blueprint-core`, `plugins/blueprint-review` and `plugins/blueprint-ship` each hold `skills/`, `agents/`, `rules/` and `evals/` folders.
- `catalogue/catalogue.json` lists every pack. `routing/` holds the routing data the checks read.
- `upstreams.json` pins the upstream commits that some vendored skills come from. `NOTICE` credits them.
- `scripts/` holds the checks and tools. `tests/` holds their tests.
- `.factory/`, `.claude/` and `.github/` configure the factory and CI for this repo itself.

## The catalogue

`catalogue/catalogue.json` lists each pack with `id`, `kind` (skill, agent, workflow or check), `source`, `licence`, `sha256`, `tags` and `eval`.

- `source` is `repo@sha#path`. For an upstream pack the sha is the pin in `upstreams.json`. For a pack that lives in this repo it is `blueprint@HEAD#path`.
- `sha256` is the hash of the pack's `SKILL.md`, or of the agent file. `eval` is the eval prompt that scores the pack, or null.
- The factory reads the file, picks packs by tag, and fetches each one by its `source`, checking the bytes against `sha256`.
- `node scripts/build-plugin.mjs` restores the vendored plugin copies from the pinned commits. Copies that already match their pin are left alone.

The factory side is the old Bun and TypeScript factory that reads this catalogue. This repo has not been checked against the Go rewrite of the factory.

## How to add a skill

1. Create `plugins/<group>/skills/<name>/SKILL.md`, where `<name>` is the folder name.
2. Set the frontmatter `name` to the same `<name>`.
3. Write a `description` of at most 1024 characters that contains "Use when".
4. Run `make check` and fix anything it reports.

## Upgrade pins

`node scripts/upgrade-pins.mjs` looks up the HEAD of each upstream in `upstreams.json` with `git ls-remote`, so it needs network access. It fetches the pinned files at that commit. When any file differs, it writes the new commit and sha256 values, updates the NOTICE line, updates the catalogue entry, and runs `check-vendor`, `check-evals` and `check-routing`. If one of them fails, it restores the old pin and prints why the pin was held.

It has no help flag, so any run changes files. Run `node scripts/upgrade-pins.mjs --dry-run` to print the plan and write nothing. It exits 1 when any pin was held. Set `UPGRADE_PINS_BASE` to a folder of bare repos to use a local upstream.

## Checks

`make check` is the gate. It runs each `scripts/check-*.mjs` except `check-mutations`, then `node --test tests/*.test.mjs`.

- `check-links` fails when a relative link in a markdown file points to a missing file.
- `check-docs` fails when a `sh` or `bash` block in this README names a Make target or script that does not exist.
- `check-prose` fails on an em dash. The other checks cover structure, agents, catalogue, evals, routing and vendored files.

`make test FILES="tests/a.test.mjs"` runs only the named test files.
`make check-mutations` breaks each check on purpose and confirms that its test fails.

Book a call at kaas.team
