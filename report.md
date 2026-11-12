BRANCH: cluster/blueprint-verify
HEAD: 5dda3d25cabf28fffd7f92013bd6a32f404d20f4
## Summary
check-evals now fails when an eval prompt's skill_sha256 differs from its SKILL.md. Own catalogue entries are pinned to a full commit sha (no release tag exists), `@HEAD` fails, and every entry has `score: null`. All in one commit, not one per group.
## Acceptance
- check-evals fails on skill_sha256 mismatch -> "a skill_sha256 that differs from the SKILL.md fails" and "...that matches ... passes" -> done
- Own entries use blueprint@<tag>#path, check fails on @HEAD; sha used because no tag exists (git ls-remote --tags is empty) -> "fails when an own entry uses @HEAD", "passes an own entry pinned to a full sha or a release tag" -> done (commit sha 550e013 of main, used for all five own entries; the check also accepts vXYZ tags)
- score on every entry, null until scored -> "every real catalogue entry has a score field", "fails when an entry has no score field" -> done
- Catalogue README section under 20 lines -> 8 lines -> done
## Files outside my area
none
## Goldens changed
none. catalogue/catalogue.json was edited (source refs, score field), which is the data under this task.
## Gate evidence
make check: rc=0, "# tests 159 / # pass 159 / # fail 0"
Bite proof: with scripts/ reverted, 7 tests failed, including the 4 new ones; restored afterwards.
## Learnings
- upgrade-pins tests build their own catalogue fixture, so a new catalogue rule breaks them; update that fixture in the same change.
- The sha pin only checks format, not that the commit holds the file; a later tag should replace it.
