BRANCH: cluster/blueprint-design
HEAD: 4f8e70e7f2d3d78e95b4ab84cc76df65c0d3d8a6
## Summary
Added the `blueprint-design` plugin with three skills (read-design, design-system-map, visual-check), routing cases, eval cases and catalogue entries. visual-check ships a small script that writes the FACTORY_GATES line.
## Acceptance
- 2-3 skills, each under 120 lines with a trigger description -> tests/blueprint-design.test.mjs "three skills, each under 120 lines" -> done
- visual-check writes a FACTORY_GATES line -> gate line tests in tests/blueprint-design.test.mjs (broke the status logic once, 1 test failed, reverted) -> done
- Upstream skills by pin, if any -> none used, so upstreams.json is unchanged -> already held
- Routing cases pass check-routing; catalogue and vendor checks pass -> make check -> done
## Files outside my area
- .claude-plugin/marketplace.json: lists the new plugin
- routing/{read-design,design-system-map,visual-check}.json: the routing check reads this folder
- tests/blueprint-design.test.mjs: new tests
- tests/scaffold.test.mjs, tests/nightly-evals.test.mjs: pinned the plugin set to three groups, now four
## Goldens changed
none (the two tests above were edited for the new group, no cap or baseline raised)
## Gate evidence
# tests 171
# pass 171
# fail 0
# cancelled 0
# skipped 0
## Learnings
- The marketplace and nightly tests hard-code the plugin list, so adding a plugin always touches them; the brief should list them as allowed files.
- visual-check compares by eye, not by pixels; a pixel diff would need an image dependency the repo does not have.
