import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AGENT_DIRS, loadCatalogue, recommendForRepo, searchSkills } from './catalog.mjs';
import { installSkill } from './install.mjs';

const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const problem = (message) => ({ isError: true, content: [{ type: 'text', text: message }] });

export function createServer(root, version = '0.1.0') {
  const skills = loadCatalogue(root);
  const find = (id) => skills.find((s) => s.id === id);
  const server = new McpServer({ name: 'kaas-blueprint', version });

  server.registerTool('search_skills', {
    description: 'Search the blueprint skills catalogue by words and tags. Returns id, tags and description.',
    inputSchema: { query: z.string().optional(), tags: z.array(z.string()).optional() },
  }, async ({ query, tags }) => text(searchSkills(skills, { query, tags })));

  server.registerTool('get_skill', {
    description: 'Return the SKILL.md of one skill and its pin (source repo, commit, licence, checksum).',
    inputSchema: { id: z.string() },
  }, async ({ id }) => {
    const s = find(id);
    if (!s) return problem(`unknown skill "${id}"`);
    const { source, licence, sha256, tags } = s;
    return text({ id, tags, pin: { source, licence, sha256 }, skill_md: readFileSync(join(s.src, 'SKILL.md'), 'utf8') });
  });

  server.registerTool('recommend_for_repo', {
    description: 'Read package.json, go.mod, pyproject.toml, Cargo.toml and CI files in a folder and rank skills for it.',
    inputSchema: { path: z.string() },
  }, async ({ path }) => {
    try { return text(recommendForRepo(skills, path)); } catch (e) { return problem(e.message); }
  });

  server.registerTool('install_skill', {
    description: `Install a skill for a coding agent (${Object.keys(AGENT_DIRS).join(', ')}). Writes into that agent's skills folder in the project, or the home folder when global is true.`,
    inputSchema: {
      id: z.string(),
      agent: z.enum(Object.keys(AGENT_DIRS)),
      project_dir: z.string().optional(),
      global: z.boolean().optional(),
      force: z.boolean().optional(),
    },
  }, async ({ id, agent, project_dir, global, force }) => {
    const s = find(id);
    if (!s) return problem(`unknown skill "${id}"`);
    try {
      const dest = installSkill(s, { agent, projectDir: project_dir, global, force });
      return text(`installed ${id} to ${dest}`);
    } catch (e) { return problem(e.message); }
  });

  return server;
}

export async function serveStdio(root, version) {
  await createServer(root, version).connect(new StdioServerTransport());
}
