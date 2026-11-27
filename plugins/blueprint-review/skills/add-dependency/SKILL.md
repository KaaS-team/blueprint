---
name: add-dependency
description: "Vet a package before it enters a lockfile: it exists, who maintains it, its age, whether the repo already has one, sibling-repo versions. Use when asked for \"add a package\", \"install X\", \"which library\", npm or bun add."
argument-hint: "[package name | the capability you need]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - WebFetch
---

# add-dependency

The dependency rule in `${CLAUDE_PLUGIN_ROOT}/engineering.md`, as a procedure. Every commercial model invents package names at a
measurable rate, and attackers register the plausible ones. A dependency is the one edit that runs
arbitrary code on your machine and in production.

## Step 1: do you need it at all

Before naming a package, check the repo:

```bash
python3 -c "import json;d=json.load(open('package.json'));print(sorted({**d.get('dependencies',{}),**d.get('devDependencies',{})}))"
ls packages/ 2>/dev/null
```

A monorepo that already has `@repo/queue`, `@repo/db` or a shared `logger` usually has the capability
in-house. Reaching for a library because it is faster to import than to look is how three packages end
up doing one job.

Bun and Node cover more than they used to: `Bun.serve`, `bun:sqlite`, `Bun.redis`, `Bun.file`, `Bun.$`,
built-in `WebSocket`, `fetch`, `node:crypto`. Check before adding a shim.

## Step 2: prove it exists, from the registry not from memory

```bash
npm view <pkg> name version time.created time.modified maintainers repository.url license
```

If that errors, **the package does not exist**. Do not try a similar name; stop and say so. A model
suggesting a name that is not in the registry is the exact slopsquatting setup, and the near-miss name
is the dangerous one.

## Step 3: judge what came back

| Signal | Refuse or question |
|---|---|
| `time.created` within the last few months | A brand-new package with the name you expected is the classic slopsquat |
| One maintainer, no recognisable org, few versions | Fine for a leaf utility, not for anything touching auth, payments or the network |
| `time.modified` over a year old | Unmaintained. Check open issues before depending on it |
| No `repository.url` | You cannot read the source. Treat as disqualifying |
| License absent or incompatible | Stop |
| Name is one character or one word off a popular package | Assume typosquat until proven otherwise |

Read the actual source of anything small enough to read. Most utility packages are under 200 lines.

For the whole lockfile (advisories, maintainers, Scorecard), run the `supply-chain-risk-auditor` skill.
It sends package names and versions to public registries and uses your `gh` token; pass `--offline`
where egress is not allowed.

## Step 4: check for drift across the sibling repos

The same library pinned at two different majors across two production apps is a real failure here:
better-auth once sat at `1.6.9` in one app and `^1.4.18` in another; Resend is `^4.5.1` and `^6.9.2`.

```bash
for f in "$WORKSPACE"/*/package.json "$WORKSPACE"/*/*/package.json; do
  grep -l '"<pkg>"' "$f" 2>/dev/null
done
```

Match the version a sibling already uses unless you can say why this repo differs.

## Step 5: respect deliberate pins

Some versions are pinned for a reason and an "upgrade" breaks the build:

| Repo | Pinned | Why |
|---|---|---|
| one app | `bun@1.3.14` | It writes `bun.lock`; a skew triggers an integrity failure |
| one app | `playwright@1.60.0` | Bound to Chromium build 1223, which both Dockerfiles bake |
| one app | a React canary | Via root `overrides` |

Read the repo's `AGENTS.md` before changing any pinned version.

## Step 6: install and verify

Use the repo's package manager, never a different one. Then:

```bash
git diff -- '*lock*' | head -40    # what actually entered the tree
make check                          # or the repo's gate
```

Read the lockfile diff. One package added should not pull in forty. If it does, say the number and what
they are before moving on.

## Report

| Item | Answer |
|---|---|
| Needed, or already available in-repo | |
| Exists in the registry | version, created, last modified |
| Maintainer and repository | |
| License | |
| Sibling repos pinning a different version | |
| Transitive packages added | count |
| Gate after install | PASS / FAIL |

If any check fails, say so and stop. Never install a package you could not verify and then mention it
afterwards.

---

## Success criteria

- The package exists on the registry under exactly the name you are about to install. A
  name that only looks right is how slopsquatting works.
- A maintainer, a last-publish date and a repository link were all read, not assumed.
- The repo was searched for something that already does the job.
- Sibling repos were checked for a different major of the same package.

## Scope and limitations

Vets one dependency before it enters a lockfile. It does not upgrade existing packages,
does not audit the whole tree, and cannot judge whether a healthy package is the right
design. A clean vet means "safe to add", never "should add".
