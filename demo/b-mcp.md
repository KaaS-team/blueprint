You are one of 20 cloud sessions preparing a live client demo of three KaaS products: **blueprint** (skills and rules for coding agents and software teams), **kaasbot** (24/7 AI teammates) and **factory** (the AI SDLC software factory). The demo starts in about 2 hours. CLI and MCP are the surfaces that matter; a web UI is out of scope.

## Hard limits
- **60 minutes.** At minute 50, stop new work, make what you have green, push and write the report. A smaller thing that works beats a bigger thing that half works.
- Stay inside **Your area**. Another session owns everything else. If you must touch a file outside it, make the smallest edit and list it in the report.
- Never push to `main`, `next` or any branch but your own. Never edit `.github/workflows/` (cloud tokens cannot push it): put the needed change in the report.

## Research first (at most 12 minutes), then copy, don't invent
Before writing code, read the source of the upstreams named in your ticket (`git clone --depth 1`, or WebFetch the raw files) and note the behaviour you will copy: command names, flags, output shape, tool names. Popular, proven shapes beat new ones. Copy code only from MIT or Apache-2.0 sources, with a `Ported from <repo>@<sha> <path>` header and a `THIRD_PARTY_NOTICES.md` entry. AGPL, non-commercial and unlicensed repos are ideas only. Name every upstream you used in the report.

## How to work
- For each acceptance line: write the test, watch it fail, write the code, watch it pass.
- No network, real token or model call in any test; fakes and `httptest` only.
- No provider API key anywhere. No model name, token count or cost in any customer-facing text (README, demo docs, PR body).
- Plain English in docs and output: short sentences, no em dashes, no filler.
- Commit with `git commit -s`. Push after each green step: `git push -u origin <your branch>`. Run the repo's gate (named below) before the last push; it must pass with zero errors and zero warnings.

## Report (required)
Write `.factory/reports/<ticket>.md` on your branch and push it last:
1. **Demo commands:** the exact commands a presenter types, in order, with the real output you got (trimmed).
2. **Acceptance:** each line, done or blocked with the reason.
3. **Upstreams copied:** repo@sha and what you took.
4. **Files outside my area** and **workflow changes needed**, if any.

## Repo and gate
Repo `KaaS-team/blueprint` (Node 22, ESM), branch from `origin/main`. Gate: `make check`. Read `README.md`, `bin/kaas-blueprint.mjs`, `catalogue/` and `upstreams.json` first.
Your branch: `demo/b-mcp`. Ticket id for the report: `b-mcp`.

## Your area
bin/, src/mcp/ (new), tests/

## Ticket: `kaas-blueprint mcp`: the skills catalogue inside any coding agent
- Stdio MCP server (`@modelcontextprotocol/sdk`, vet the version) with tools: search_skills (query, tags), get_skill (id, returns SKILL.md and pin), recommend_for_repo (reads package.json, go.mod, pyproject, Cargo.toml, CI files of the given path and ranks catalogue entries), install_skill (id, agent: claude, codex, cursor, gemini; writes to that agent's skills or rules folder).
Upstreams to read: `anthropics/skills` and the Agent Skills spec (agentskills.io), `vercel-labs/skills` or whichever `npx skills add` installer is most used today, `intellectronica/ruler` (one source of rules for many agents).
## Acceptance
- [ ] An e2e test drives the server with the SDK client: list tools, search, get, recommend on a fixture Go repo returns Go-relevant skills first.
- [ ] install_skill writes the right path for each of the four agents (table test).
- [ ] `docs/demo/mcp.md` with the `claude mcp add blueprint -- npx -y github:KaaS-team/blueprint mcp` line.
