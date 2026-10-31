<!-- factory:planned v1 -->
Repo: KaaS-team/blueprint
Deps: none
Epic: E11.2 Skills, agents, rules
Milestone: Phase 11 blueprint
Runner: factory

## Risk: high

## Why
Blueprint ships one skill, plan-critic. Seven more come from three MIT projects. Each must be pinned to a commit, carry its licence, and be checked byte for byte offline in `make check`, so nobody can quietly edit or swap one. The engineering skills, agents and rules from a private kit can only come in through an importer that strips every company mention and refuses to write a leak. The charter rates vendored upstream pins high risk, so this plan is high. It covers the issue #8 scope and the parked plan in #7: same pins, same checks, one PR.

## Today
- `main` is `e797fe0`. The only skill is `plugins/blueprint-review/skills/plan-critic/`; every other `plugins/<group>/{skills,agents,rules,evals}/` holds only `.gitkeep`.
- `Makefile` `check` names four commands one by one (`check-structure`, `check-prose`, `check-links`, `node --test tests/*.test.mjs`); `test: check` ignores any file list; `check-mutations` reads only `tests/mutations.json`.
- `scripts/check-structure.mjs` defines `BANNED`, `DOMAIN` and `COMMAND` locally. For each `SKILL.md` it requires `name` to equal the folder, a description containing "Use when", and a description of at most 1024 characters. It runs the identity check over `scannedFiles`.
- `scripts/check-prose.mjs` fails any prose file containing U+2014. `scripts/check-links.mjs` fails any relative markdown link whose target is missing.
- Three upstream texts break those checks as published: `code-review-and-quality/SKILL.md` contains U+2014, `domain-modeling/SKILL.md` links to example paths such as `./src/billing/GLOSSARY.md` that do not exist, and the `improve-codebase-architecture` description has no "Use when". None contains a banned word, and every `name` matches its folder.
- `NOTICE` credits the three upstreams as MIT without the pinned commit or the licence text. `tests/scaffold.test.mjs` asserts that credit and the `.gitkeep` files.
- `bin/kaas-blueprint.mjs` copies whole skill folders, so a `LICENSE` inside a skill folder travels with the skill.
- The upstream commits, all MIT and verified on GitHub:
  - addyosmani/agent-skills at `1401c8b8030e023baeebb31781a6653fe8e93026`
  - mattpocock/skills at `5beb35b040e3de97e54fa9e386d7e42d15c295c2`
  - obra/superpowers at `8ca22dba9a94f28898bbce59f2537ff4d87c747d`

## Change
### T1: a test target, sorted checks, and a mutations folder
Files: `Makefile`, `scripts/check-mutations.mjs`, `tests/check-mutations.test.mjs`, `tests/makefile.test.mjs`
Model: sonnet
1. In `Makefile`, set `CHECKS := $(filter-out scripts/check-mutations.mjs,$(sort $(wildcard scripts/check-*.mjs)))`. `check` runs `for c in $(CHECKS); do node $$c || exit 1; done` and then `node --test tests/*.test.mjs`. A new `scripts/check-*.mjs` therefore joins the gate without another Makefile edit.
2. `test` becomes: when `FILES` is empty, `$(MAKE) check`; otherwise `node --test $(FILES)`. Add `vendor`, which runs `node scripts/sync-upstream.mjs`. Add `vendor` to `.PHONY`.
3. In `scripts/check-mutations.mjs`, build the entry list from `tests/mutations.json` (when it exists) followed by every `tests/mutations/*.json` sorted by name. Each file is a JSON array of `{file, search, replace, test}`. The label stays `${file} (${test})`.
4. In `tests/check-mutations.test.mjs`, add a test: a fixture whose only entry sits in `tests/mutations/extra.json` with a toothless test fails with `/survived/`.
5. `tests/makefile.test.mjs` runs `make -n check` in the repo root and asserts the output names every `scripts/check-*.mjs` on disk except `check-mutations.mjs`. It also runs `make -n test FILES=tests/scaffold.test.mjs` and asserts the output contains `node --test tests/scaffold.test.mjs` and no `check-structure`.

### T2: pins, hashes and the offline vendor check
Files: `upstreams.json`, `scripts/lib.mjs`, `scripts/check-vendor.mjs`, `scripts/sync-upstream.mjs`, `tests/check-vendor.test.mjs`, `tests/mutations/vendor.json`
Model: sonnet
Deps: T1
1. Create `upstreams.json` at the repo root as an array, one entry per upstream: `{ "repo": "<owner>/<name>", "sha": "<40 hex>", "licence": "MIT", "files": [{ "from": "<path at the sha>", "to": "<repo path>", "sha256": "<64 hex>" }] }`. Entries are sorted by `repo`, and `files` inside each are sorted by `to`. Use exactly the files in the table below. For every skill folder an upstream supplies, add one more entry: `from` is `LICENSE` and `to` is `<skill folder>/LICENSE`, with the licence hash for that upstream.
2. In `scripts/lib.mjs`:
   - Move `BANNED`, `DOMAIN` and `COMMAND` here from `check-structure.mjs` and export them.
   - Export `sha256File(root, rel)`, which returns `createHash('sha256').update(readFileSync(join(root, rel))).digest('hex')` over the raw bytes.
   - Export `upstreams(root)`, which returns the parsed `upstreams.json` or `[]` when the file is missing.
   - Export `vendoredFiles(root)`, which returns a `Set` of every `to`.
3. `scripts/check-vendor.mjs [root]` fails when any of these hold:
   - a `repo` does not match `/^[\w.-]+\/[\w.-]+$/`;
   - a `sha` is not 40 lowercase hex;
   - a `licence` is not `MIT`;
   - a `to` is missing on disk;
   - a file's bytes differ from its pin. Write this check as exactly the line `if (sha256File(root, f.to) !== f.sha256) problems.push(\`${f.to}: bytes differ from the pin\`);`
   - a file that `listFiles` returns under a vendored skill folder (the folder holding a vendored `SKILL.md`) is not a `to`;
   - a vendored skill folder has no `LICENSE` entry;
   - `NOTICE` does not contain each `repo` followed on the same line by its `sha`.
   It ends with `finish('vendor', problems)`.
4. `scripts/sync-upstream.mjs [repo]` handles every upstream, or only the named one. For each `files` entry it fetches `https://raw.githubusercontent.com/<repo>/<sha>/<from>`, compares the sha256 of the response bytes to the pin, and writes the bytes to `to` only on a match. Any mismatch or non-200 response is printed, and the script then exits 1. It never rewrites `upstreams.json`. `make vendor` runs it. It is not part of `make check`.
5. `tests/check-vendor.test.mjs` uses `fixture` and `assertFails`/`assertPasses` from `tests/helpers.mjs`, over a fixture with one upstream and one skill folder holding `SKILL.md` and `LICENSE`. It covers:
   - the clean fixture passes;
   - one changed byte fails with `/bytes differ/`;
   - an extra unlisted file in the skill folder fails;
   - a 39-character sha fails;
   - a `licence` of `GPL-3.0` fails;
   - a `NOTICE` without the sha fails.
6. `tests/mutations/vendor.json` holds the entry under Mutation, written with the key `search`.

| upstream | from | to | sha256 |
|---|---|---|---|
| obra/superpowers | `skills/systematic-debugging/SKILL.md` | `plugins/blueprint-core/skills/systematic-debugging/SKILL.md` | `808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787` |
| obra/superpowers | `skills/systematic-debugging/condition-based-waiting-example.ts` | `plugins/blueprint-core/skills/systematic-debugging/condition-based-waiting-example.ts` | `40ae5ebe497fdf310200e43fe986552546d0a22837c0d39e855db1cfd33eb88e` |
| obra/superpowers | `skills/systematic-debugging/condition-based-waiting.md` | `plugins/blueprint-core/skills/systematic-debugging/condition-based-waiting.md` | `e89fec8400d6cd50f43407cec9fab50976ba4d55d0ec2eb51c0bd68036b54c26` |
| obra/superpowers | `skills/systematic-debugging/defense-in-depth.md` | `plugins/blueprint-core/skills/systematic-debugging/defense-in-depth.md` | `1e175fb86fc357e58c6aebf5441e481e1b7868b4380c0456b63a17eefbd18ba7` |
| obra/superpowers | `skills/systematic-debugging/find-polluter.sh` | `plugins/blueprint-core/skills/systematic-debugging/find-polluter.sh` | `dd7b8f13c4cc2a24b33ff87b18da9248f3e1c80a085c3316224f69ff0fa5c43c` |
| obra/superpowers | `skills/systematic-debugging/root-cause-tracing.md` | `plugins/blueprint-core/skills/systematic-debugging/root-cause-tracing.md` | `75b933b6a8c40bdb2031b10f21654395b56ec6ab6bc7b018c18d3fe57aeb7fb8` |
| obra/superpowers | `skills/verification-before-completion/SKILL.md` | `plugins/blueprint-core/skills/verification-before-completion/SKILL.md` | `2befe7fc55bcadaa3d97dd9e8efeb633d2561c0ebe74c5a8b17c4d9e7e4520b3` |
| obra/superpowers | `LICENSE` | each obra skill folder `/LICENSE` | `a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400` |
| mattpocock/skills | `skills/productivity/grilling/SKILL.md` | `plugins/blueprint-core/skills/grilling/SKILL.md` | `befdff1e27a1dfe2a294d5871169ac1afe16d983911daa4f32627514a48c1e15` |
| mattpocock/skills | `skills/engineering/domain-modeling/ADR-FORMAT.md` | `plugins/blueprint-core/skills/domain-modeling/ADR-FORMAT.md` | `944c92aa790e8fbdc9199640b170979abb8a34ba8d0fe18c2a01a63bce140ca0` |
| mattpocock/skills | `skills/engineering/domain-modeling/GLOSSARY-FORMAT.md` | `plugins/blueprint-core/skills/domain-modeling/GLOSSARY-FORMAT.md` | `21dcc40cdec8e151a829b98ab1517c1867bc444e3665134a98c6983411996801` |
| mattpocock/skills | `skills/engineering/domain-modeling/SKILL.md` | `plugins/blueprint-core/skills/domain-modeling/SKILL.md` | `7b925d7b1e341a2eeae33ad68a8a8c0ab889a38ddd22a7598e4c240e5a7556a3` |
| mattpocock/skills | `skills/engineering/improve-codebase-architecture/HTML-REPORT.md` | `plugins/blueprint-review/skills/improve-codebase-architecture/HTML-REPORT.md` | `581e8bb5a521e46bbda8ca7e19b15948bed882187108092ebb90c62513b77528` |
| mattpocock/skills | `skills/engineering/improve-codebase-architecture/SKILL.md` | `plugins/blueprint-review/skills/improve-codebase-architecture/SKILL.md` | `552240a5ab5cec6b67c15dd1ad6e9f6962b1bca6ce870059a8c2713760c20392` |
| mattpocock/skills | `skills/engineering/codebase-design/DEEPENING.md` | `plugins/blueprint-review/skills/codebase-design/DEEPENING.md` | `f3dd099ce99289bd213914d8ee3e2429b78309c3957ca4583f7659551b1d53c1` |
| mattpocock/skills | `skills/engineering/codebase-design/DESIGN-IT-TWICE.md` | `plugins/blueprint-review/skills/codebase-design/DESIGN-IT-TWICE.md` | `52b52e75655a27aea59c6966b410bac82448968ad46ef1ebb9f07c274e3ae010` |
| mattpocock/skills | `skills/engineering/codebase-design/SKILL.md` | `plugins/blueprint-review/skills/codebase-design/SKILL.md` | `2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2` |
| mattpocock/skills | `LICENSE` | each mattpocock skill folder `/LICENSE` | `0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5` |
| addyosmani/agent-skills | `skills/code-review-and-quality/SKILL.md` | `plugins/blueprint-review/skills/code-review-and-quality/SKILL.md` | `2db1e850379f255fd3091ef278cde24cd6c7d2ba23e360cc52ea522c40d4396e` |
| addyosmani/agent-skills | `LICENSE` | `plugins/blueprint-review/skills/code-review-and-quality/LICENSE` | `6f202f8bd568cd730dbb2b0d1f8e243bc74c2fa1f64dbce9b2c7ea08bd5c9fd7` |

### T3: vendor the seven skills, exempt their prose, quote the licences
Files: `scripts/check-structure.mjs`, `scripts/check-prose.mjs`, `scripts/check-links.mjs`, `tests/check-structure.test.mjs`, `tests/check-prose.test.mjs`, `tests/check-links.test.mjs`, `NOTICE`, `plugins/blueprint-core/skills/systematic-debugging/SKILL.md`, `plugins/blueprint-core/skills/systematic-debugging/condition-based-waiting-example.ts`, `plugins/blueprint-core/skills/systematic-debugging/condition-based-waiting.md`, `plugins/blueprint-core/skills/systematic-debugging/defense-in-depth.md`, `plugins/blueprint-core/skills/systematic-debugging/find-polluter.sh`, `plugins/blueprint-core/skills/systematic-debugging/root-cause-tracing.md`, `plugins/blueprint-core/skills/systematic-debugging/LICENSE`, `plugins/blueprint-core/skills/verification-before-completion/SKILL.md`, `plugins/blueprint-core/skills/verification-before-completion/LICENSE`, `plugins/blueprint-core/skills/grilling/SKILL.md`, `plugins/blueprint-core/skills/grilling/LICENSE`, `plugins/blueprint-core/skills/domain-modeling/SKILL.md`, `plugins/blueprint-core/skills/domain-modeling/ADR-FORMAT.md`, `plugins/blueprint-core/skills/domain-modeling/GLOSSARY-FORMAT.md`, `plugins/blueprint-core/skills/domain-modeling/LICENSE`, `plugins/blueprint-review/skills/improve-codebase-architecture/SKILL.md`, `plugins/blueprint-review/skills/improve-codebase-architecture/HTML-REPORT.md`, `plugins/blueprint-review/skills/improve-codebase-architecture/LICENSE`, `plugins/blueprint-review/skills/codebase-design/SKILL.md`, `plugins/blueprint-review/skills/codebase-design/DEEPENING.md`, `plugins/blueprint-review/skills/codebase-design/DESIGN-IT-TWICE.md`, `plugins/blueprint-review/skills/codebase-design/LICENSE`, `plugins/blueprint-review/skills/code-review-and-quality/SKILL.md`, `plugins/blueprint-review/skills/code-review-and-quality/LICENSE`
Model: sonnet
Deps: T2
1. Run `make vendor`. The 27 vendored files must land with bytes unchanged. Never edit a vendored byte, not even to fix the em dash or a link.
2. In `scripts/check-structure.mjs`, import `BANNED`, `DOMAIN`, `COMMAND` and `vendoredFiles` from `./lib.mjs`, and set `const vendored = vendoredFiles(root);`. Right after the `fm.name !== folder` line, add exactly `if (vendored.has(file)) continue;`, so a vendored `SKILL.md` still needs a matching name but skips the description rules. The identity loop stays as it is and still scans vendored files.
3. In `scripts/check-prose.mjs`, add `vendoredFiles` with `const vendored = vendoredFiles(root);`. The filter becomes `.filter((f) => !vendored.has(f) && readText(root, f).includes(EM_DASH))`.
4. In `scripts/check-links.mjs`, change the file filter to `.filter((f) => f.endsWith('.md') && !vendored.has(f))`, using the same `vendored` set.
5. Each of the three test files gains two tests:
   - a fixture with an `upstreams.json` that lists the offending file passes: a SKILL.md with no "Use when", a prose file with U+2014, or a markdown file with a dead link;
   - the same fixture without the `upstreams.json` entry still fails.
   `tests/check-structure.test.mjs` also asserts that a vendored file containing `kaas` fails.
6. Append to `NOTICE`, after the existing lines, one block per upstream. Each block is the line `<repo> at <sha>` (the format `check-vendor.mjs` reads), then the line `Files: ` followed by the vendored skill folders, then the upstream `LICENSE` text quoted in full. Keep every existing line, so `tests/scaffold.test.mjs` passes unchanged.

### T4: the kit importer, run by the operator
Files: `scripts/import-kit.mjs`, `tests/import-kit.test.mjs`, `tests/fixtures/kit/skills/eng-intent/SKILL.md`, `tests/fixtures/kit/skills/eng-ship/SKILL.md`, `tests/fixtures/kit/skills/verify/SKILL.md`, `tests/fixtures/kit/agents/verifier.md`, `tests/fixtures/kit/rules/kaas-comments.md`, `tests/fixtures/kit-leak/skills/eng-intent/SKILL.md`, `tests/mutations/import.json`
Model: sonnet
Deps: T2
1. `scripts/import-kit.mjs <kit-plugin-dir> [--out <root>]` (default `--out` is the repo root) reads these sources, relative to the kit plugin dir, and writes these targets:

   | source | target |
   |---|---|
   | `skills/eng-intent/SKILL.md` | `plugins/blueprint-core/skills/intent/SKILL.md` |
   | `skills/eng-debug-e2e/SKILL.md` | `plugins/blueprint-core/skills/debug-e2e/SKILL.md` |
   | `skills/eng-add-dependency/SKILL.md` | `plugins/blueprint-review/skills/add-dependency/SKILL.md` |
   | `skills/eng-new-guard/SKILL.md` | `plugins/blueprint-review/skills/structural-test/SKILL.md` |
   | `skills/eng-audit-repo/SKILL.md` | `plugins/blueprint-review/skills/repo-audit/SKILL.md` |
   | `skills/eng-impact-map/SKILL.md` | `plugins/blueprint-ship/skills/impact-map/SKILL.md` |
   | `skills/eng-ship/SKILL.md` | `plugins/blueprint-ship/skills/ship/SKILL.md` |
   | `agents/verifier.md` | `plugins/blueprint-core/agents/verifier.md` |
   | `agents/complexity-surgeon.md` | `plugins/blueprint-review/agents/complexity-surgeon.md` |
   | `agents/gate-triage.md` | `plugins/blueprint-ship/agents/gate-triage.md` |
   | `engineering.md` | `plugins/blueprint-core/rules/engineering.md` |
   | `rules/kaas-comments.md` | `plugins/blueprint-core/rules/comments.md` |

   Two sources are merged rather than mapped. The body of `skills/verify/SKILL.md` (frontmatter removed) is appended to `ship` under the heading `## Verify`. The body of `agents/structural-test-author.md` is appended to `structural-test` under the heading `## Structural test author`. A missing source prints `missing <source>` and is skipped.
2. Rewrites, in this order:
   - Inside the frontmatter block, set `name:` to the target name (the skill folder, or the agent file stem). Drop any `model:` line. In `description:`, replace the first `Use for ` with `Use when asked for `.
   - Everywhere, replace each `kaas-eng:<kit name>` and each bare kit skill name (`eng-intent` and so on, plus `verify` only when written as `kaas-eng:verify`) with its blueprint name.
   - Outside the frontmatter, drop every line that matches `BANNED` once `DOMAIN` and `COMMAND` are removed, or that contains `~/` or `/Users/`. Print each dropped line to stderr as `dropped <target>:<line number>: <line>`.
   - Never drop a frontmatter line.
3. Build every output in memory first. Before writing anything, run the guard on each output, written as exactly `if (BANNED.test(out.replace(DOMAIN, '').replace(COMMAND, ''))) throw new Error(\`${target}: still names the company\`);`. A throw exits 1 and writes no file.
4. The fixture kit under `tests/fixtures/kit/` contains:
   - one skill line naming the company;
   - one `/Users/` path;
   - a `model:` line in the agent;
   - a `Use for` description;
   - a `kaas-eng:eng-intent` reference inside `eng-ship`;
   - a `verify` body.
   `tests/fixtures/kit-leak/` has a description that names the company.
5. `tests/import-kit.test.mjs` runs the importer with `--out` set to a temp dir. It asserts:
   - `intent/SKILL.md` has `name: intent`, a description containing `Use when`, and no company line or `/Users/` line;
   - `ship/SKILL.md` contains `## Verify` and the reference rewritten to `intent`;
   - `verifier.md` has no `model:` line;
   - stderr lists each dropped line;
   - the leak fixture exits 1 with `/still names the company/` and leaves the temp dir empty.
6. `tests/mutations/import.json` holds the entry under Mutation, written with the key `search`.

## Tests
- `tests/check-vendor.test.mjs`: [permanent] the pin rules, one fixture per failure, and a passing clean fixture.
- `tests/check-structure.test.mjs`, `tests/check-prose.test.mjs`, `tests/check-links.test.mjs`: [permanent] the vendored exemptions apply only to files listed in `upstreams.json`, and the identity check still scans vendored files.
- `tests/import-kit.test.mjs`: [permanent] the importer renames, merges, strips, and refuses a leak.
- `tests/check-mutations.test.mjs`: [permanent] entries in `tests/mutations/*.json` are run.
- `tests/makefile.test.mjs`: [permanent] `make check` runs every check script and `make test FILES=` runs only the named files.
- `tests/scaffold.test.mjs`, `tests/installer.test.mjs`: [permanent] existing, unchanged, still green.

## Mutation
```json
{"name":"vendor: bytes unchecked","file":"scripts/check-vendor.mjs","find":"if (sha256File(root, f.to) !== f.sha256)","replace":"if (false)","test":"tests/check-vendor.test.mjs"}
```
```json
{"name":"import: a leak is written","file":"scripts/import-kit.mjs","find":"if (BANNED.test(out.replace(DOMAIN, '').replace(COMMAND, '')))","replace":"if (false)","test":"tests/import-kit.test.mjs"}
```
```json
{"name":"structure: every skill skips the description rules","file":"scripts/check-structure.mjs","find":"if (vendored.has(file)) continue;","replace":"continue;","test":"tests/check-structure.test.mjs"}
```

## Acceptance
- AC-1: `make test FILES=...` runs only the named files, and a new `scripts/check-*.mjs` joins `make check` without a Makefile edit: checked by `make test FILES=tests/makefile.test.mjs` (T1)
- AC-2: the mutation runner reads `tests/mutations/*.json`: checked by `make test FILES=tests/check-mutations.test.mjs` (T1)
- AC-3: a changed vendored byte, an unlisted file, a short sha, a non-MIT licence or a missing NOTICE pin fails offline: checked by `make test FILES=tests/check-vendor.test.mjs` (T2)
- AC-4: the seven skills are present byte for byte with their licences, and NOTICE quotes each pin: checked by `make check` (T3)
- AC-5: only listed vendored files skip the prose, link and description rules, and the identity check still scans them: checked by `make test FILES="tests/check-structure.test.mjs tests/check-prose.test.mjs tests/check-links.test.mjs"` (T3)
- AC-6: the importer renames, merges, strips company lines and home paths, and refuses a leak: checked by `make test FILES=tests/import-kit.test.mjs` (T4)
- AC-7: each mutation fails its test: checked by `make check-mutations` (T4)

## Non-goals
- NG-1: running `scripts/import-kit.mjs` against the private kit is an operator step after merge, because the factory cannot read the kit. The operator reviews the printed dropped lines and opens the import PR. That PR also carries eval cases, as #9 requires.
- NG-2: no hook scripts. `plugins/*/hooks/**` is protected.
- NG-3: no eval cases. They are #9.
- NG-4: trailofbits skills are not included because of their licence. No upstream file outside the table is taken (for example `CREATION-LOG.md`, `test-*.md`, `agents/openai.yaml`).
- NG-5: no change to `.github/workflows/`, `.factory/`, `.claude/`, `.agents/`, `bin/` or `package.json`.
- NG-6: process rules for this PR:
  - one PR for the whole spec;
  - the PR body follows `.github/pull_request_template.md` section by section, with `Closes #8`;
  - every commit carries a `Signed-off-by:` line (`git commit -s`);
  - no em dash in any file this PR writes outside the vendored bytes;
  - no price copy;
  - no file outside Files.

## Files
- `Makefile`
- `scripts/check-mutations.mjs`
- `scripts/lib.mjs`
- `scripts/check-structure.mjs`
- `scripts/check-prose.mjs`
- `scripts/check-links.mjs`
- `scripts/check-vendor.mjs` (new)
- `scripts/sync-upstream.mjs` (new)
- `scripts/import-kit.mjs` (new)
- `upstreams.json` (new)
- `NOTICE`
- `tests/check-mutations.test.mjs`
- `tests/makefile.test.mjs` (new)
- `tests/check-structure.test.mjs`
- `tests/check-prose.test.mjs`
- `tests/check-links.test.mjs`
- `tests/check-vendor.test.mjs` (new)
- `tests/import-kit.test.mjs` (new)
- `tests/mutations/vendor.json` (new)
- `tests/mutations/import.json` (new)
- `tests/fixtures/kit/skills/eng-intent/SKILL.md` (new)
- `tests/fixtures/kit/skills/eng-ship/SKILL.md` (new)
- `tests/fixtures/kit/skills/verify/SKILL.md` (new)
- `tests/fixtures/kit/agents/verifier.md` (new)
- `tests/fixtures/kit/rules/kaas-comments.md` (new)
- `tests/fixtures/kit-leak/skills/eng-intent/SKILL.md` (new)
- `plugins/blueprint-core/skills/systematic-debugging/SKILL.md` (new)
- `plugins/blueprint-core/skills/systematic-debugging/condition-based-waiting-example.ts` (new)
- `plugins/blueprint-core/skills/systematic-debugging/condition-based-waiting.md` (new)
- `plugins/blueprint-core/skills/systematic-debugging/defense-in-depth.md` (new)
- `plugins/blueprint-core/skills/systematic-debugging/find-polluter.sh` (new)
- `plugins/blueprint-core/skills/systematic-debugging/root-cause-tracing.md` (new)
- `plugins/blueprint-core/skills/systematic-debugging/LICENSE` (new)
- `plugins/blueprint-core/skills/verification-before-completion/SKILL.md` (new)
- `plugins/blueprint-core/skills/verification-before-completion/LICENSE` (new)
- `plugins/blueprint-core/skills/grilling/SKILL.md` (new)
- `plugins/blueprint-core/skills/grilling/LICENSE` (new)
- `plugins/blueprint-core/skills/domain-modeling/SKILL.md` (new)
- `plugins/blueprint-core/skills/domain-modeling/ADR-FORMAT.md` (new)
- `plugins/blueprint-core/skills/domain-modeling/GLOSSARY-FORMAT.md` (new)
- `plugins/blueprint-core/skills/domain-modeling/LICENSE` (new)
- `plugins/blueprint-review/skills/improve-codebase-architecture/SKILL.md` (new)
- `plugins/blueprint-review/skills/improve-codebase-architecture/HTML-REPORT.md` (new)
- `plugins/blueprint-review/skills/improve-codebase-architecture/LICENSE` (new)
- `plugins/blueprint-review/skills/codebase-design/SKILL.md` (new)
- `plugins/blueprint-review/skills/codebase-design/DEEPENING.md` (new)
- `plugins/blueprint-review/skills/codebase-design/DESIGN-IT-TWICE.md` (new)
- `plugins/blueprint-review/skills/codebase-design/LICENSE` (new)
- `plugins/blueprint-review/skills/code-review-and-quality/SKILL.md` (new)
- `plugins/blueprint-review/skills/code-review-and-quality/LICENSE` (new)
