BRANCH: cluster/blueprint-catalogue
HEAD: a5c4a07a28f2dbdd152555c9a30b47be3fc61065
## Summary
Added catalogue/catalogue.json (12 packs: 7 upstream skills, 2 own skills, 3 own agents) with a check against upstreams.json, a build-plugin script, and upgrade-pins now edits eval prompts and the catalogue with each bump. README has a Catalogue section of 11 lines.
## Acceptance
- catalogue.json covering upstreams.json plus own skills, checked both ways -> tests/check-catalogue.test.mjs ("fails when an upstream pack has no catalogue entry", "fails when a catalogue entry names no upstream pack", "passes the real repo") -> done
- build-plugin regenerates vendored copies, no change on a clean tree -> tests/build-plugin.test.mjs ("on a clean tree it writes nothing...", "a deleted or edited copy is regenerated...", CLI on the real tree) -> done
- upgrade-pins pairs a bump with an eval edit -> tests/upgrade-pins.test.mjs ("a bumped SKILL.md gets its eval file hash updated...", "a second bump replaces...", "a held bump restores...") -> done (seen failing before the fix)
- Licence check, non MIT or Apache-2.0 fails -> tests/check-catalogue.test.mjs ("fails when an entry is not MIT or Apache-2.0") -> done (seen failing with the check disabled)
- README Catalogue section under 20 lines -> make check -> done
## Files outside my area
none
## Goldens changed
none. New mutation files: tests/mutations/catalogue.json, build-plugin.json, upgrade-pins.json.
## Gate evidence
1..153
# tests 153
# suites 0
# pass 153
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7438.224787
## Learnings
- Own entries have no fixed commit, so I used `blueprint@HEAD#path` as source; the brief's repo@sha form needs a decision for them.
- check-evals asks only for an eval change, not a hash, so I defined `skill_sha256` in the eval prompt front matter; nothing verifies it yet.
- build-plugin needs a source of bytes, since the catalogue holds only hashes; it uses the same upstream source as upgrade-pins.
- The identity check scans catalogue/, so the repo name could not appear in it.
- Untracked files are not reverted by git checkout; revert one-off mutations by hand.
