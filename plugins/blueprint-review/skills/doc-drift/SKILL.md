---
name: doc-drift
description: Use when code changed and you must find docs that no longer match it. Lists the commands, flags, paths and names the docs mention, checks each against the code, and reports every mismatch with file and line. Use after a change, before a release.
---

# doc-drift

Finds documentation that has drifted from the code. It reports. It does not
rewrite docs unless asked.

## Steps

1. List the docs: README, files under `docs/`, and any `--help` text the repo
   keeps in source.
2. Pull out the claims a reader could act on: commands, flags, file paths,
   environment variables, function and option names, and sample output.
3. Check each claim against the code or by running the command with `--help`.
   A claim is **stale** when the thing it names no longer exists or behaves
   differently. It is **missing** when the code has a command or flag that no
   doc mentions.
4. Do not trust a doc's own description of itself. Open the code.
5. Write one line per mismatch: `file:line  stale|missing  claim  what the code says`.

## Report

Give the count of stale and missing items first. Then the list. If there is
nothing to report, say that you checked N claims and found none, and name the
docs you read.

## Do not

- Do not fix a mismatch by editing the code to match the doc.
- Do not report style or wording. Only report claims that are wrong or absent.
- Do not guess. If you cannot check a claim, list it as unchecked with the reason.
