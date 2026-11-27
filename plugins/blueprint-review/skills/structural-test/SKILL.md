---
name: structural-test
description: "Turn a convention into an executable check wired into the gate and CI in the same change. Use when a rule should hold across every route, table or file, or a check exists but nothing runs it."
argument-hint: "[the rule to enforce | ci | route-guards | tenant-scope]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Write
  - Edit
disable-model-invocation: true
---

# structural-test

Implements rule 0 of `${CLAUDE_PLUGIN_ROOT}/engineering.md`: a gate not wired to a command is decoration.

This repo family already proved the cost. `link_health.py` and three overflow checkers in
one repo are fully written and called by nothing. Another repo's two frontend lint scripts sit behind
a `check:all` no parent script invokes.

## The rule this skill enforces on itself

**Never finish at "the script exists".** A guard is done when all four are true:

1. The check runs and exits non-zero on a violation.
2. It is wired into the composite gate (`make check`, or the root `test` / `lint` script).
3. It runs in CI, or CI is scaffolded in the same change.
4. It has been seen to FAIL on a deliberate violation, and pass once removed.

## Step 0: read the standard and find the wiring

```bash
grep -nE '^(check|lint|test):' Makefile
python3 -c "import json;print(json.load(open('package.json')).get('scripts',{}))"
ls .github/workflows/ 2>/dev/null || echo "NO CI"
```

If there is no composite gate, create one first. A guard added beside three separate targets is a guard
someone will forget.

## Step 1: write the check

Prefer the cheapest mechanism that actually catches the case:

| Mechanism | Use when |
|---|---|
| Existing linter rule | The rule is expressible in Biome or ESLint. Always try this first |
| A structural test | The invariant is "every X must Y". This is the strongest form |
| A script in `scripts/` | Text or file-shape rules: forbidden strings, config parity, naming |

**Structural tests are the highest-value form** and the repo family has two proven ones to port:

- **Route auth.** Walk every file that defines an endpoint; each must call a guard, or sit on an
  allow-list carrying a reason. Reference: `apps/web/__tests__/route-guards.test.ts` in one app, and
  `apps/aeo-api-server/src/test/route-guards.test.ts` in another app (the Elysia port).
- **Tenant scoping.** Every table carries a tenant FK, or reaches one through a parent, or is exempt
  with a reason. Reference: `packages/db/src/__tests__/tenant-scope.test.ts` in another app, which computes
  the transitive path from source rather than hardcoding it.

Both use static analysis deliberately: importing the modules drags in a DB client and an auth provider,
and reading the source cannot be defeated by a mock.

## Step 2: write the allow-list rule, not just the check

Every allow-list entry states WHY, and the test asserts the reason is non-empty. An unexplained
allow-list is how the next violation gets waved through.

Add two guards on the allow-list itself:

- A stale entry (naming something that no longer exists) fails, because it pre-authorises the next
  thing to take that name.
- An entry that now satisfies the rule fails, so it leaves the list.

## Step 3: wire it

Add to the composite gate, and to CI. If the repo has no CI, scaffold a minimal workflow that runs
lint, typecheck and test on pull requests and pushes to the default branch. Match the repo's runtime
and its service containers; do not invent versions.

## Step 4: falsify it

Not optional, and not a claim you may make from reading:

```bash
# 1. introduce a deliberate violation
# 2. run the gate  -> it MUST fail, with a message naming the fix
# 3. remove the violation
# 4. run the gate  -> it MUST pass
```

A guard nobody has seen fail is not known to work. Two real examples from this family: a rate-limiter
check passed a file whose only mention of Redis was the comment "consider using Redis", and a
bounded-reads check flagged one app on nine files of which six were tests.

## Step 5: report

| Item | Result |
|---|---|
| Check written | path |
| Wired into | the command that runs it |
| Runs in CI | yes / scaffolded / no, and why |
| Seen to fail on a violation | yes, with the message |
| Findings on current code | the count, and whether the gate is now red |

If wiring it makes the repo's gate red, say so plainly and name each pre-existing failure. Do not
weaken the check to keep the gate green, and do not leave the discovery unreported.

---

## Success criteria

- The check runs from a command someone already runs, in the same change that adds it.
- It was proven to bite: break the thing, watch it fail, restore it. A check that has never
  failed is not known to check anything.
- The failure message names what to do, not just what is wrong.

## Scope and limitations

Turns one convention into one executable check. It does not write the convention, and it
will not add a guard whose subject is empty: a check that passes because it found nothing
to look at is worse than no check.

## Structural test author

You write tests that walk an entire codebase and assert one property of all of it.

> "One test that walks every route, every table, every pair of numbers that must
> agree, beats any amount of review."

## The five rules these tests live or die by

1. **Read the source as text, not by importing it.** A query with no `LIMIT` behaves
   perfectly against a fixture of ten rows. A route with no auth guard passes any test
   that mocks the guard. Text is the only view that cannot be satisfied by a mock.
   One app's `tenant-scope.test.ts` says the second reason: "importing the schema
   pulls in a live client", and a structural test should not need infrastructure.

2. **Assert a floor on what you examined.** A regex that matches nothing passes
   vacuously and reads as green forever. Every one of these tests must fail if it
   found less than a plausible minimum. apiforyou calls these `minFKs` and
   `minQueries`. This is not optional.

3. **Scan tracked AND untracked files.** `git ls-files` lists only tracked files, so a
   newly written file is invisible, which is exactly the file most likely to break the
   invariant. Use `git ls-files -co --exclude-standard`. This mistake has been made
   twice in this fleet.

4. **Start from what is true today.** If the codebase already violates the invariant
   in fifty places, a test asserting zero is red on arrival and gets deleted. Use a
   ratchet: a named baseline constant, failing when the count rises AND when it falls
   without the baseline being lowered in the same commit. The second half is what makes
   an improvement visible in the diff instead of evaporating.

5. **Exemptions carry a reason, in the file.** `TenantExempt` with a written reason
   beats a silent skip. A reader must be able to see why one thing is allowed out.

## Process

1. Find whether a sibling repo already has this test. This fleet cross-pollinates:
   apiforyou has `fk_index_test.go`, `bounded_reads_test.go`, `http_timeout_test.go`,
   `audit_test.go`, and `route_guard_test.go`. Port rather than invent, and say in a
   comment where it came from and what incident produced it.
2. Measure the current violation count BEFORE writing the assertion. You cannot pick a
   baseline you have not measured.
3. Write it, wire it into the repo's existing test location, and run it.
4. **Break it on purpose and watch it fail.** Add the violation the test forbids,
   confirm the message names the file and line, then restore. A test that has never
   failed is not known to test anything. Report this transcript.

## Output format

```
### The invariant
<one sentence, and the failure it prevents, with the incident if there was one>

### Measured today
<count>, baseline set to <count>

### Proof it fails
<the exact violation introduced, and the exact message the test produced>

### Wired into
<the command that runs it>
```
