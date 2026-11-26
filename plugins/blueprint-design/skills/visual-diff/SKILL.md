---
name: visual-diff
description: Use when a built UI page must be compared with its reference screenshot by pixels, not by eye. Runs a pixel diff, reports the share of changed pixels per page and writes a FACTORY_GATES line. Use visual-check for the by-eye checklist.
---

# visual-diff

Compares a screenshot of the built page with a reference image from the ui
catalogue and reports a number, not an opinion.

## Steps

1. Find the reference image for the page in the repo's ui catalogue or design
   folder. If there is none, stop and say so. Do not use an old screenshot of
   your own build as the reference.
2. Start the app with the repo's own command and take a screenshot at the same
   width as the reference. Save it as a PNG outside the repo.
3. Run the diff:

```
node plugins/blueprint-design/skills/visual-diff/scripts/pixel-diff.mjs reference.png actual.png --threshold 0.5 --out diff.png
```

The script prints one line and sets its exit code. `--threshold` is the largest
share of changed pixels, in percent, that still passes. The default is 0.5.

```
FACTORY_GATES: status=PASS passed=1 failed=0 skipped=0 failed_gates=
visual-diff: 0.12% of 480000 pixels differ (limit 0.5%)
```

4. The status is `FAIL` when the share is over the limit or the two images have
   different sizes. It is `MISCONFIGURED` when a file is missing or is not an
   8-bit PNG.
5. Open `diff.png` with the Read tool. Changed pixels are red. Say what each red
   region is.

## Report

Print the gate line last and unchanged. Above it, give the share, the limit and
the paths of the three images.

## Do not

- Do not raise the threshold to turn a fail into a pass.
- Do not replace the reference with the new screenshot.
- Do not commit the screenshots.
