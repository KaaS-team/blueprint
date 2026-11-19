# Blueprint skills inside your coding agent (MCP)

`kaas-blueprint mcp` starts a stdio MCP server. Your agent can then search the skills catalogue, read a skill, ask which skills fit a repo and install one, all without leaving the chat.

## Add it

Claude Code:

```sh
claude mcp add blueprint -- npx -y github:KaaS-team/blueprint mcp
```

Any other MCP client: run `npx -y github:KaaS-team/blueprint mcp` as a stdio server.

## Tools

| Tool | What it does |
| --- | --- |
| `search_skills` | Find skills by words (`query`) and `tags`. |
| `get_skill` | Return the SKILL.md of one skill and its pin: source repo and commit, licence, checksum. |
| `recommend_for_repo` | Read go.mod, package.json, pyproject.toml, Cargo.toml and CI files in `path`, then rank skills for that repo. |
| `install_skill` | Copy a skill into an agent's skills folder. |

`install_skill` takes `id`, `agent` (`claude`, `codex`, `cursor` or `gemini`), and optional `project_dir`, `global` and `force`. It refuses to overwrite unless `force` is true.

| Agent | Folder |
| --- | --- |
| claude | `.claude/skills/<id>/` |
| codex | `.codex/skills/<id>/` |
| cursor | `.cursor/skills/<id>/` |
| gemini | `.gemini/skills/<id>/` |

## Try it

Ask your agent:

1. "Which blueprint skills fit this repo?" It calls `recommend_for_repo`.
2. "Show me the debugging skill." It calls `get_skill`.
3. "Install it for Claude." It calls `install_skill`.

Without an agent, you can check the server with the MCP inspector:

```sh
npx -y @modelcontextprotocol/inspector node bin/kaas-blueprint.mjs mcp
```
