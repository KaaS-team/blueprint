# b-team report

## Demo commands
Run in any git repo that has a CLAUDE.md:

    node /path/to/blueprint/bin/kaas-blueprint.mjs init --team --dry-run
    node /path/to/blueprint/bin/kaas-blueprint.mjs init --team
    node /path/to/blueprint/bin/kaas-blueprint.mjs init --team     # prints: nothing to change
    node bin/kaas-blueprint.mjs init --team --agents claude,cursor

Real output with tree before and after: docs/demo/team.md.

## Acceptance
- Table test per agent target, second run no-op, CLAUDE.md kept with one pointer line: done (tests/init-team.test.mjs, 9 tests).
- docs/demo/team.md with a real run, before and after: done. `tree` is not installed here, so it uses `find | sort`.

## Upstreams copied
None copied. Shapes only, from memory and not re-read in this run (time): ruler (one rules source fanned out to each agent), agents.md spec (AGENTS.md plus a CLAUDE.md pointer), Claude Code settings and hooks ($CLAUDE_PROJECT_DIR hook paths). Cursor uses .cursor/rules/*.mdc with alwaysApply. Gemini uses context.fileName in .gemini/settings.json.

## Files outside my area
- docs/demo/team.md (ticket-required), .factory/reports/b-team.md.
- bin/kaas-blueprint.mjs is in my area; new logic is in plugins/blueprint-ship/rollout/team.mjs.

## Workflow changes needed
None. make check: 189 pass, 0 fail.

## Notes
- Tests were written together with the code, not watched failing first.
- Hooks are copied into .claude/blueprint-ship/hooks/ and referenced via $CLAUDE_PROJECT_DIR.
- Rules come from plugins/blueprint-ship/rules/*.md inside a marker block, replaced on each run.
