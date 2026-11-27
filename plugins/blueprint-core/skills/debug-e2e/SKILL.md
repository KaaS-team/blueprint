---
name: debug-e2e
description: "Diagnose a failing or flaky e2e suite by ruling out the environment first: stale dev server, docker build, Redis state, Playwright build. Use when asked for \"e2e failing\", \"flaky test\", or a pasted Playwright trace."
argument-hint: "[spec name, or paste the failure]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# debug-e2e

**"Flaky" is not a diagnosis.** It is the name for a cause you have not found yet. Finish with a named
cause and the evidence for it, or say plainly that you could not find one and what you ruled out.

Most failures in these repos are environmental, and the environment is checkable in under a minute. Do
that first: chasing a diff that is not at fault is the expensive mistake.

## Step 1: rule out the environment, in this order

| Check | Command | Why it matters |
|---|---|---|
| A dev server holding the app port | `lsof -ti:3080` | Playwright reuses an existing server (`reuseExistingServer`), so `make dev` left running reintroduces the Turbopack flakiness the prod-build config exists to avoid |
| A concurrent docker build or other load | `docker ps`, check CPU | The suite runs `workers: 1` and needs an otherwise idle machine. A concurrent build fails roughly 20 specs |
| Infra actually up | `make dev-ps` | Integration and e2e both talk to real Postgres and Redis |
| The right Chromium | see below | A wrong `playwright install` bakes a build the pinned worker cannot launch |

**Stop `make dev` before `make test-e2e`.** This single cause accounts for more red suites here than any
code change.

## Step 2: know what the harness already does for you

In one app, `make test-e2e` is self-orchestrating (`scripts/e2e-deterministic.sh`). It:

- stops the Docker jobs-runner, which has no `E2E_TEST` and holds :3081
- migrates and resets the DB
- flushes `one app:sub:*` (the posts cache **and** the `due:` / `iv:` adaptive cadence, which otherwise
  marks a subreddit not-due for up to 6h across runs), plus `search:*` and `sess:pool`
- flushes every `bull:*` key, because the DB reset deletes the websites those queued jobs point at, and
  dead jobs occupy the three scout worker slots the specs wait on
- starts a host jobs-runner with `E2E_TEST=1`, runs Playwright, restores the container on exit

You only need infra up. If you are hand-running Playwright and seeing odd state, you are probably
skipping one of those steps rather than finding a bug.

The tell for the `bull:*` case: **the failure looks like a broken app, and the spec passes when run
alone.**

## Step 3: the Chromium mismatch

Symptom: `Executable doesn't exist at /ms-playwright/chromium_headless_shell-<build>`.

The build number in the error is what the worker **wants**. Compare against what is there:

```bash
docker run --rm -v app_ms_playwright:/v alpine ls /v
```

A mismatch means an install resolved the wrong playwright. Bun's isolated install hides the pinned copy
under `node_modules/.bun/playwright-core@<version>/`, so a bare `bunx playwright` at the repo root
resolves to **latest**. Every install must run from a package that depends on playwright
(`cd packages/ingest && bunx playwright install chromium`).

Fix the install CWD, rebuild, and `docker volume rm app_ms_playwright`. A wiping `make clean` is NOT
required and will not help if the image still bakes the wrong build.

## Step 4: only now, suspect the diff

From here the method is the `systematic-debugging` skill (root cause before any fix, one
hypothesis at a time). This skill adds only what is specific to our harness.

```bash
git stash && make test-e2e     # does it pass without your change?
git stash pop
```

If it passes clean, your change is implicated and you have evidence. If it fails clean, the failure is
pre-existing and belongs in the report as such, not silently fixed or silently ignored.

## Step 5: if it is genuinely intermittent

Reproduce it a fixed number of times and record the rate. One failure in one run is not a rate.

```bash
for i in 1 2 3 4 5; do
  bun run --cwd apps/web test:e2e -- e2e/<spec>.spec.ts >"/tmp/e2e-$i.log" 2>&1
  echo "run $i: $?"
done
```

Then capture the actual failure: the trace (`trace: 'on-first-retry'` is configured), the screenshot, the
jobs-runner stdout. A screenshot of the wrong page tells you more than the assertion message.

Known determinism patterns worth checking in the spec itself: use `fillStable` rather than a bare fill;
give each poll a **fresh** deadline rather than one shared across steps; assert against the API rather
than a re-rendered UI where the API is the source of truth; and never make a spec wait on a BullMQ cron.

## Step 6: report

| Item | Answer |
|---|---|
| Environment ruled out | port, load, infra, Chromium: each yes/no |
| Passes without the diff | yes / no |
| Reproduction rate | n of m runs |
| Cause | named, with the evidence line |
| Fix | and the assertion that now covers it |

If the cause is environmental, say which one and how it was confirmed. "Environmental" on its own is the
same non-answer as "flaky".

---

## Success criteria

A named cause, reproduced deliberately, and a test that fails before the fix and passes
after. "Flaky" is not a cause and does not close anything.

## Scope and limitations

Diagnoses the suite and its environment: stale servers on the app port, concurrent builds,
unflushed state, wrong browser build. It does not write features to make a failing spec
pass, and it never raises a timeout to turn a red run green.
