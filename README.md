# blueprint

Open engineering skills, agents and hooks for coding-agent teams.

## Layout

Three plugin groups live under `plugins/`: `blueprint-core`, `blueprint-review` and `blueprint-ship`.
Each has `skills/`, `agents/`, `rules/` and `evals/` folders.

## Install skills

From a clone, copy a skill into the skills folder of your coding agent:

```
node bin/kaas-blueprint.mjs add plan-critic
```

- `--agent <name>` picks the agent: `claude` (`.claude/skills`, the default), `codex` (`.codex/skills`), `cursor` (`.cursor/skills`), `pi` (`.pi/skills`) or `agents` (`.agents/skills`).
- By default skills go into the current folder. `--global` uses your home folder instead, and `--dir <path>` uses exactly that folder. The two cannot be combined.
- `--force` replaces a skill folder that already exists. Without it, an existing folder is refused and nothing is written.
- `list` prints every skill with its group, and `list --json` prints the same as JSON.
- A group name such as `review` installs every skill in that group. Group names are the plugin folder names without the `blueprint-` prefix: `core`, `review` and `ship`.
- An unknown name exits with code 2 and suggests the nearest skill or group.

## How to add a skill

1. Create `plugins/<group>/skills/<name>/SKILL.md`, where `<name>` is the folder name.
2. Set the frontmatter `name` to the same `<name>`.
3. Write a `description` of at most 1024 characters that contains "Use when".
4. Run `make check` and fix anything it reports.

`node bin/kaas-blueprint.mjs --help` prints usage. The package is publishable: `npm pack` makes a tarball and `npx ./kaas-blueprint-*.tgz --help` runs the installer from it.

## Upgrade pins

`node scripts/upgrade-pins.mjs` looks up the HEAD of each upstream in `upstreams.json` with `git ls-remote` and fetches the pinned files at that commit. When any file differs, it writes the new commit and sha256 values, updates the NOTICE line, and runs `check-vendor`, `check-evals` and `check-routing`. If one of them fails, it restores the old pin and bytes and prints why the pin was held. `--dry-run` prints the plan and writes nothing. It exits 1 when any pin was held. Set `UPGRADE_PINS_BASE` to a folder of bare repos to use a local upstream.

## Catalogue

`catalogue/catalogue.json` lists every pack: `id`, `kind` (skill, agent, workflow or check), `source`, `licence`, `sha256`, `tags`, `eval` and `score`. `score` is null until a scored eval result exists.

- `source` is `repo@sha#path`. For an upstream pack the sha is the pin in `upstreams.json`. For a pack that lives in this repo it is `blueprint@<ref>#path`, where the ref is a release tag, or a full commit sha while no tag exists (none does yet, so the entries use a commit sha). `@HEAD` fails the check.
- `sha256` is the hash of the pack's `SKILL.md`, or of the agent file. `eval` is the eval prompt that scores the pack, or null.
- The factory reads the file, picks packs by tag, and fetches each one by its `source`, checking the bytes against `sha256`.
- `scripts/check-catalogue.mjs` fails when the catalogue and `upstreams.json` disagree in either direction, when a skill or agent here is missing, or when a licence is not MIT or Apache-2.0.
- `scripts/check-evals.mjs` fails when an eval prompt's `skill_sha256` differs from the sha256 of its skill's `SKILL.md`.
- `node scripts/build-plugin.mjs` restores the vendored plugin copies from the pinned commits. Copies that already match their pin are left alone.
- `upgrade-pins` updates the catalogue entry, and writes `skill_sha256` into the eval prompts of a skill whose `SKILL.md` changed.

## Checks

`make check` runs the structure, prose and link checks, then the node tests. It needs only Node and make.
`make check-mutations` breaks each check on purpose and confirms that its test fails.

Book a call at kaas.team
