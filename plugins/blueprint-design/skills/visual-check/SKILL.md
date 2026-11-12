---
name: visual-check
description: Use when a UI page or component has been built from a design and you must check how it looks against that design before saying it is done. Screenshots the built page, compares it with the design, and writes a FACTORY_GATES line for the result.
---

# visual-check

Checks a built page against its design by looking, then reports the result as a
gate line the factory can parse.

## Steps

1. Start the app or the component story with the repo's own command. Run it in
   the background and wait until it answers. If it will not start, the check
   fails with the gate name `app-start`. Do not skip it.
2. Take a screenshot of the page at each width the design shows. Use the
   browser tooling the environment has, for example Playwright. Save the files
   outside the repo, in the scratchpad or a temp folder.
3. Open the design image and each screenshot with the Read tool.
4. Build a checklist from the component list: one line per component and one per
   state the design shows. For each line, look at both images and mark it
   `pass` or `fail`. A fail needs a one sentence reason, such as
   "button label reads Submit, design says Start free".
5. Check the same things every time: text copy, order of elements, layout
   direction, visible states, and whether the colours and spacing come from
   tokens (read the source, do not judge by eye alone).
6. Write the checklist as JSON, `[{"name": "PricingCard", "pass": true}]`, and
   run:

```
node plugins/blueprint-design/skills/visual-check/scripts/gate-line.mjs checks.json
```

The script prints one line and sets its exit code:

```
FACTORY_GATES: status=PASS passed=4 failed=0 skipped=0 failed_gates=
```

`status` is `PASS` when nothing failed and at least one check ran. It is `FAIL`
when any check failed, and `MISCONFIGURED` when the file is missing, is not
valid, or lists no checks. Failed names go in `failed_gates`, joined by commas.
A check with `"skipped": true` counts as skipped, not as passed.

## Report

Print the gate line last and unchanged. Above it, list each failed check with
its reason, and name the screenshots by path. State plainly that the comparison
was made by eye. This skill does not compute a pixel difference.

## Do not

- Do not mark a check `pass` that you did not look at in both images.
- Do not edit the design or the checklist to turn a fail into a pass.
- Do not commit the screenshots.
