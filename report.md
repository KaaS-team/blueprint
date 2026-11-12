BRANCH: cluster/shed-blueprint
HEAD: 4f0abdd6f3ef98f108e893fb2421768435624797
## Summary
Small repo, little dead weight. Removed one stale CI copy and fixed the README, which had a duplicated section and claims that no longer matched the code.
## Removed
- Stale file: ci/ci.yml (19 lines), an unreferenced older copy of .github/workflows/ci.yml.
- Docs: README "The catalogue" section (older duplicate of "Catalogue", and it claimed `@HEAD` sources are valid while the other says they fail the check).
- Docs claims fixed: "three plugins" now four; `list` output now includes the design skills; groups now include `design`; layout names blueprint-design.
## Kept, unsure
- scripts/import-kit.mjs: only its test calls it, no recipe or doc. Test pins it, so kept.
- scripts/sync-upstream.mjs (`make vendor`) overlaps build-plugin.mjs, but one fetches over HTTP and one uses git pins; different paths, kept.
- .factory/config.example.json: no reference found, but looks like a factory template.
- .gitkeep files in non-empty plugin dirs: tests/scaffold.test.mjs requires them.
## Size
10019 lines before, 9996 after (excluding the .agents/skills symlink, which wc cannot read).
## Gate evidence
# tests 180
# pass 180
# fail 0
## Learnings
- The brief's `xargs wc` errors on the .agents/skills symlink to a directory; exclude it.
- Commits omit the harness co-author trailer and session URL because the brief forbids session links.
