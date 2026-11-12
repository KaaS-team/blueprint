BRANCH: cluster/blueprint-wow
HEAD: eadb335e4a924b030f1ab3c941347bda92889a7a
## Summary
Added the first-run skill with routing prompts, eval and fixture repo, made plan-critic the one plan rubric, made the package publishable with a working --help, and added upgrade-pins. The real upgrade-pins run held all three pins, so no pin or vendored file moved.
## Acceptance
- first-run skill in the review plugin, description top-1 for 4 added prompts -> tests/first-run.test.mjs (walk order, Use when, rank 1 for at least three prompts); reverting the "auditor reaudit" step made it fail -> done
- eval for first-run with trigger and outcome graders on a fixture repo under the skill's fixtures/ -> plugins/blueprint-review/evals/first-run--audit, check-evals ok, tests/first-run.test.mjs -> done
- scripts/upgrade-pins.mjs with injectable source, offline checks, --dry-run, local bare repo tests -> tests/upgrade-pins.test.mjs (7 tests); skipping the checks made the held test fail -> done
- run upgrade-pins for real against the three upstreams -> blocked in effect: all three held, nothing to commit. addyosmani/agent-skills (301b02b): check-evals says code-review-and-quality SKILL.md changed with no eval change. mattpocock/skills (5863806): same for grilling and improve-codebase-architecture. obra/superpowers (22f0b463): same for systematic-debugging. Pins and bytes were restored and the tree stayed clean. I did not weaken the rule or add eval edits just to pass it.
- package.json drops private; npm pack then npx ./kaas-blueprint-*.tgz --help prints usage -> tests/package.test.mjs; also added --help/-h/help to bin/kaas-blueprint.mjs, which printed an error before; reverting both made all 3 tests fail -> done
- plan-critic is the one plan rubric, test fails on a second one -> tests/plan-rubric.test.mjs (a planted plan-rubric skill made it fail) -> done. Added eval case plan-critic--rubric because check-evals requires an eval change when SKILL.md changes.
## Files outside my area
none
## Goldens changed
none
## Gate evidence
# tests 133
# suites 0
# pass 133
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4339.08343
(check-vendor, check-evals, check-routing each print ok)
## Learnings
- The check-evals changed-case rule holds every vendored SKILL.md bump, so upgrade-pins cannot move a pin until the same change also edits that skill's eval; a follow-up should let upgrade-pins pair a bump with a re-run eval or let the supervisor edit the evals by hand.
- I could not know the auditor install command, so first-run tells the user to install it and does not guess one.
- The sed edit with # inside the replacement failed silently once; use python for README edits.
