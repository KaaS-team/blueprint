<!-- factory:planned v1 -->
Repo: KaaS-team/blueprint
Deps: none
Epic: E11.1 Installer
Milestone: Phase 11 blueprint
Runner: factory

## Why
Blueprint ships a marketplace with three plugin groups and one skill, but a person using a coding agent other than the one the marketplace targets has no way to take a skill except copying folders by hand. This issue adds a zero-dependency Node installer that copies named skills, or whole groups, into the skills directory of the agent the person uses. The command is named `kaas-blueprint`, not `blueprint`, per #14, so it never clashes with an existing global `blueprint` command; a test pins that name. #8 lists this issue as its dependency, so the installer lands before the fifteen skills do and its tests run over a fixture tree, not over today's single skill.

## Today
- No `bin/` folder and no `package.json` exist; the repo is Markdown plus Node scripts with no dependencies. `make check` (`Makefile`) runs `node scripts/check-structure.mjs`, `node scripts/check-prose.mjs`, `node scripts/check-links.mjs` and `node --test tests/*.test.mjs`, so a new `tests/*.test.mjs` file is wired into the gate and CI with no Makefile or workflow edit. CI (`.github/workflows/ci.yml`, human-owned) runs `make check` on Node 22 with `timeout-minutes: 3`.
- Skills live at `plugins/<group>/skills/<skill>/SKILL.md` with groups `blueprint-core`, `blueprint-review`, `blueprint-ship`. The only skill is `plugins/blueprint-review/skills/plan-critic/`, which also holds `scripts/check-plan.mjs` and a `fixtures/` folder, so a skill is a whole folder, not one file. The other `skills/` folders hold only `.gitkeep`.
- `scripts/check-structure.mjs` defines `BANNED = /\b(?:kaas|lwp|learnwithparam)\b/i` and `DOMAIN = /\bkaas\.team\b/gi`, and for every scanned file runs `const text = readText(root, file).replace(DOMAIN, '');` then fails on `BANNED.test(text)`. Scanned files are everything git lists except `.factory/`, `.claude/`, `.agents/`, `.github/`, `scripts/`, `tests/`, `NOTICE` and `LICENSE` (`scripts/lib.mjs` `isScanned`). So `bin/`, `package.json` and `README.md` are scanned, and the word `kaas-blueprint` fails the check today because `-` is a word boundary. #8 T3 reuses `DOMAIN` by name, so it must keep its name and meaning.
- `tests/helpers.mjs` exports `ROOT`, `fixture(files)` (writes files into a fresh git repo in a temp dir), `assertFails(script, root, pattern)` and `assertPasses(script, root)`. `tests/check-structure.test.mjs` has 11 tests in that style, including `passes kaas.team alone`.
- `tests/mutations.json` is an array of `{ file, search, replace, test }` (the key is `search`, not `find`); `scripts/check-mutations.mjs` (`make check-mutations`) copies the repo, requires `search` to occur exactly once, requires the test to pass unmutated, and requires the mutated run to exit exactly 1.
- `tests/scaffold.test.mjs` requires `README.md` to keep `## How to add a skill` and `Book a call at kaas.team`, to hold no prices, and every group to have no `hooks/` folder.
- `.factory/config.json` `protectedPaths` and `.factory/charter.md` protect `.factory/**`, `.claude/**`, `.agents/**`, `.github/**` and `plugins/*/hooks/**`; nothing in this plan touches them. The charter rates a change to the installer as medium risk.
- `make check` is green on `main` at 155d820.

## Change
### T1: let the command name through the identity check
Files: `scripts/check-structure.mjs`, `tests/check-structure.test.mjs`, `tests/mutations.json`
Model: sonnet
1. In `scripts/check-structure.mjs`, under `DOMAIN`, add `const COMMAND = /\bkaas-blueprint\b/gi;` with a one-line comment: the installer's command name is allowed, like the domain. Leave `BANNED` and `DOMAIN` unchanged.
2. Replace the scan line with exactly this line: `const text = readText(root, file).replace(DOMAIN, '').replace(COMMAND, '');`
3. In `tests/check-structure.test.mjs` add two tests: `passes the kaas-blueprint command name` (a `README.md` holding `npx kaas-blueprint add plan-critic` passes) and `fails another kaas- word` (a `README.md` holding `kaas-tools` fails, matching `/README\.md/`).
4. Append the T1 entry from Mutation to `tests/mutations.json`, written in the repo's own shape: `{ "file", "search", "replace", "test" }`, with `search` set to the plan's `find`.

### T2: the kaas-blueprint installer
Files: `bin/kaas-blueprint.mjs`, `package.json`, `tests/installer.test.mjs`, `tests/mutations.json`, `README.md`
Model: sonnet
Deps: T1
1. Create `bin/kaas-blueprint.mjs` (mode 755, first line `#!/usr/bin/env node`, Node built-ins only: `node:fs`, `node:path`, `node:os`, `node:url`, `node:process`; under 200 lines; no word `kaas` except inside `kaas-blueprint`). Usage text names the command `kaas-blueprint`.
2. Source root: `--from <dir>` if given, else the folder above `bin/` (`resolve(dirname(fileURLToPath(import.meta.url)), '..')`). The catalog is every folder `plugins/<group>/skills/<skill>/` under the source root holding a `SKILL.md`; a group's short name is its folder name with the `blueprint-` prefix removed (`core`, `review`, `ship`). Build `groups` as a `Map` from short name to its skill names.
3. Agents map, exactly: `claude` to `.claude/skills`, `codex` to `.codex/skills`, `cursor` to `.cursor/skills`, `pi` to `.pi/skills`, `agents` to `.agents/skills`; default `claude`. Target skills directory: `--dir <path>` if given, else `join(opts.global ? homedir() : process.cwd(), AGENTS[agent])`. `--dir` together with `--global`, an unknown `--agent`, an unknown flag, or no command exits 2 with the usage text on stderr.
4. Exit codes as constants at the top: `const EXIT_REFUSED = 1;` and exactly this line: `const EXIT_UNKNOWN = 2;`
5. `list` prints one line per skill, `<skill>\t<group>`, sorted by group then name. `list --json` prints `[{ "name", "group" }]` through exactly this line: `if (opts.json) return out(JSON.stringify(rows, null, 2));`
6. `add <name>...` resolves every name before writing anything. A group name expands through exactly this line, in the resolver: `if (groups.has(name)) return groups.get(name);` then a skill name resolves to itself. An unknown name exits `EXIT_UNKNOWN` with `unknown skill or group "<name>"` plus `did you mean "<nearest>"?`, where nearest is the lowest Levenshtein distance over all skill and group names (a small local function, about 15 lines). Duplicates after expansion are copied once.
7. Before any copy, collect clashes for every resolved skill with exactly this line: `if (existsSync(dest) && !opts.force) clashes.push(dest);` Any clash exits `EXIT_REFUSED`, names each clashing path and says to pass `--force`, and writes nothing. With `--force`, remove `dest` (`rmSync(dest, { recursive: true, force: true })`) before copying.
8. Copy each skill folder with `mkdirSync(target, { recursive: true })` and exactly this line: `cpSync(src, dest, { recursive: true });` then print `added <skill> to <dest>` per skill.
9. Create `package.json`: `name` `kaas-blueprint`, `version` `0.1.0`, `private: true`, a one-sentence `description` with no company name, `license` `Apache-2.0`, `bin` `{ "kaas-blueprint": "bin/kaas-blueprint.mjs" }`, `engines` `{ "node": ">=22" }`, `files` `["bin/", "plugins/", "LICENSE", "NOTICE"]`. No `dependencies` or `devDependencies` key, so CI needs no install step.
10. Create `tests/installer.test.mjs`. It builds a fixture source tree with `fixture()` from `tests/helpers.mjs`: `plugins/blueprint-core/skills/alpha/SKILL.md`, `plugins/blueprint-review/skills/beta/SKILL.md`, `plugins/blueprint-review/skills/beta/scripts/run.mjs`, `plugins/blueprint-review/skills/gamma/SKILL.md`, and spawns the bin with `process.execPath` and `--from <fixture>`. It must not depend on which real skills exist, since #8 adds fifteen.
11. Add the T2 entries from Mutation to `tests/mutations.json` in the repo's `{ file, search, replace, test }` shape.
12. In `README.md` add a `## Install skills` section after `## Layout`: from a clone, `node bin/kaas-blueprint.mjs add plan-critic`; `--agent` with the five agent names and their folders; `--global`, `--dir`, `--force`; `list` and `list --json`; group names expand. Keep `## How to add a skill` and the booking line unchanged; no prices.

## Tests
- `tests/installer.test.mjs`: [permanent] `add beta --dir <tmp>` copies `beta/SKILL.md` and `beta/scripts/run.mjs` and exits 0; with no `--dir` and cwd `<tmp>`, `add alpha` writes `<tmp>/.claude/skills/alpha/SKILL.md`; each of `codex`, `cursor`, `pi`, `agents` writes under its own folder; `--global` with `HOME=<tmp>` writes under `<tmp>/.claude/skills`; `add review` copies `beta` and `gamma` and not `alpha`; `list` prints every fixture skill with its group; `list --json` parses to exactly the three `{ name, group }` rows; `add bta` exits 2 and stderr names `beta`; `add alpha nope` exits 2 and writes nothing; an existing `beta` folder with a marker file makes `add alpha beta` exit 1, keeps the marker and does not write `alpha`; the same with `--force` exits 0 and replaces `beta`; `--agent vim` exits 2; `list --json` with no `--from` lists `plan-critic` in group `review`.
- `tests/installer.test.mjs`: [permanent] #14 name pin: `package.json` `bin` keys equal exactly `["kaas-blueprint"]`, no `bin/blueprint.mjs` exists, `bin/kaas-blueprint.mjs` starts with `#!/usr/bin/env node` and is executable, and `package.json` has no `dependencies` key.
- `tests/check-structure.test.mjs`: [permanent] `kaas-blueprint` passes the identity check, another `kaas-` word still fails; the existing 11 tests stay green.

## Mutation
```json
{"name":"identity: command name not allowed","file":"scripts/check-structure.mjs","find":".replace(COMMAND, '')","replace":"","test":"tests/check-structure.test.mjs"}
```
```json
{"name":"installer: add copies nothing","file":"bin/kaas-blueprint.mjs","find":"cpSync(src, dest, { recursive: true });","replace":"void 0;","test":"tests/installer.test.mjs"}
```
```json
{"name":"installer: list ignores --json","file":"bin/kaas-blueprint.mjs","find":"if (opts.json)","replace":"if (false)","test":"tests/installer.test.mjs"}
```
```json
{"name":"installer: group names do not expand","file":"bin/kaas-blueprint.mjs","find":"if (groups.has(name)) return groups.get(name);","replace":"if (false) return [];","test":"tests/installer.test.mjs"}
```
```json
{"name":"installer: unknown name exits 1","file":"bin/kaas-blueprint.mjs","find":"const EXIT_UNKNOWN = 2;","replace":"const EXIT_UNKNOWN = 1;","test":"tests/installer.test.mjs"}
```
```json
{"name":"installer: overwrites without --force","file":"bin/kaas-blueprint.mjs","find":"if (existsSync(dest) && !opts.force)","replace":"if (false)","test":"tests/installer.test.mjs"}
```

## Acceptance
- AC-1: the identity check allows the `kaas-blueprint` command name and still refuses any other company word: checked by `tests/check-structure.test.mjs` (T1)
- AC-2: `add` copies whole skill folders into the chosen agent's skills directory, local, global or `--dir`: checked by `tests/installer.test.mjs` (T2)
- AC-3: `list` and `list --json` print every skill with its group, and a group name expands to its skills: checked by `tests/installer.test.mjs` (T2)
- AC-4: an unknown name exits 2 with the nearest name, and an existing target is refused with exit 1 and nothing written unless `--force`: checked by `tests/installer.test.mjs` (T2)
- AC-5: the only command installed is `kaas-blueprint` and the package has no dependency: checked by `tests/installer.test.mjs` (T2)
- AC-6: all six mutations are caught: checked by `scripts/check-mutations.mjs` (T2)

## Non-goals
- NG-1: no npm publish, no release workflow and no version bump flow; `package.json` is `private: true`. Publishing is a human decision with its own issue.
- NG-2: no edit under `.github/**`, `.factory/**`, `.claude/**`, `.agents/**`, and no `hooks` folder anywhere; CI needs no change because `node --test tests/*.test.mjs` already picks up the new test. If a CI change were ever needed, it is staged under `ci/` for a human PR.
- NG-3: the installer copies skills only; agents, rules, evals and hooks are not installed. `remove`, `update` and version pinning of installed skills are out of scope.
- NG-4: no new dependency: argument parsing, the copy and the nearest-name match use Node built-ins and about 15 lines of local code.
- NG-5: #14 stays open for its owner to close; this issue lands the name and its pinning test, nothing else from #14.
- NG-6: no change to the skills themselves or to `.claude-plugin/marketplace.json`.

## Risk: medium
A change to the installer is medium in this repo's charter. The installer writes into a user's home or project folder, so it resolves every name and checks every target before writing, refuses to overwrite without `--force`, and `--force` removes only the named skill folder. The identity check gains one narrow allowance (`kaas-blueprint`), pinned by a test that another `kaas-` word still fails. Rollback: revert the PR.

## Files
- `bin/kaas-blueprint.mjs` (new)
- `package.json` (new)
- `tests/installer.test.mjs` (new)
- `scripts/check-structure.mjs`
- `tests/check-structure.test.mjs`
- `tests/mutations.json`
- `README.md`
