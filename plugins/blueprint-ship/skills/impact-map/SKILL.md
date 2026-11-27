---
name: impact-map
description: "Write or fix a repo's impact map, the `impact` block in .agents/repo.json that lets scripts/check-affected.py run only the checks a change reaches. Use when asked for \"the gate is too slow\", \"only test what changed\", \"blast radius\", \"check-affected.py escalated to full\", or a repo with no map."
argument-hint: "[repo path]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
---

# impact-map

`scripts/check-affected.py` diffs the tree against the last tree that passed and runs only the checks
whose globs the changed files hit. The map decides what runs, so a map that is too narrow skips a check
that would have failed. Err wide: a check that runs and passes costs seconds; one wrongly skipped costs
a broken main. CI still runs the whole gate on every push, so a wrong map is caught, late.

A scoped `--run` runs here, half the free cores wide. `--files a,b` plans from a list instead of a diff. Mark a check `"alone": true`
when it builds or owns the database, so it never shares the pool.

## The shape

```json
"impact": {
  "full": ["package.json", "package-lock.json", "src/lib/**", "scripts/lib/**"],
  "ignore": ["docs/**", "**/*.png"],
  "fullAt": 60,
  "checks": [
    {"name": "lint", "when": ["src/**/*.ts", "src/**/*.tsx"], "run": "npx eslint --max-warnings 0 {files}"},
    {"name": "types", "when": ["src/**/*.ts", "src/**/*.tsx", "tsconfig.json"], "run": "npm run typecheck"},
    {"name": "render", "when": ["src/decks/**"], "run": "npm run check:render", "alone": true,
     "each": "src/decks/([^/]+)/", "scoped": "ONLY={items} npm run check:render"}
  ]
}
```

| Key | Means |
|---|---|
| `full` | A change here reaches everything: lockfiles, shared libraries, the check scripts' own helpers, build config |
| `ignore` | A change here needs no check at all. Keep it short; a doc usually has a prose check instead |
| `when` | Globs matched against the repo-relative path. `**/` spans folders, `*` stays in one; no implicit "anywhere" |
| `run` | The command. `{files}` becomes the changed files it matched (existing ones only) |
| `each` + `scoped` | A regex whose group 1 names an item (a deck, a lab, a package). When every matched file falls inside an item, `scoped` runs with `{items}` |
| `fullAt` | Changed-file count that escalates to the whole gate (default 60) |
| `alone` | The check writes a file others read (a generated index, tokens) or holds a port or build dir: it runs by itself, before the rest |
| `jobs` | Cap on checks run at once (default: all). The pool is half the cores free right now, so a busy machine runs them one by one |
| `covers` | Gate steps this check stands in for: `npx eslint {files}` covers the `lint` script |
| `fullOnly` | Gate steps that run only in the full gate, on purpose (a build, an e2e). CI still runs them on push |

## Steps

1. Read the gate: `.agents/repo.json` `gate`, then the Makefile target or npm script it runs. List every
   step it calls, one check per step. A step missing from the map is a step a scoped run never runs.
2. For each step, read its script head and find what it reads: a folder walk, an import, a glob. That
   is its `when`. A step that reads everything (a build, a typecheck) gets every source glob.
3. Find per-item steps (a loop over decks, labs, packages) and whether they take a filter
   (`ONLY=`, `--filter`, a path argument). If one does not, add the filter to the script before mapping it.
4. Put shared code in `full`: anything every item imports. When unsure, it goes in `full`.
5. Add `python3 scripts/check-affected.py --audit` to the gate itself (Rule 0), then run it until every
   tracked file is claimed and every gate step is run, covered or `fullOnly`. That keeps the map current: a new
   file or a new gate step fails the gate until the map names it.
6. Prove it: edit one item, run `python3 scripts/check-affected.py` and read the plan; edit a shared file
   and see `full`; run `--run` once and see the stamp. Revert the probe edits.

## Rules

- Never map a check narrower than the code it reads. Two decks sharing a component are not two items.
- `gate-stamp.py` still runs at the end of the full gate; do not remove it.
- `check-affected.py` and the Stop hook come from the kit; change them there and rerun
  `scripts/sync-vendored.py` on every consumer.
