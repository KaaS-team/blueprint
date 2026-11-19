import { detectStack, recommend } from '../../scripts/recommend.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const AGENT_DIRS = {
  claude: '.claude/skills',
  codex: '.codex/skills',
  cursor: '.cursor/skills',
  gemini: '.gemini/skills',
};

const dirs = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  const out = {};
  if (m) for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

// Returns catalogue entries joined with the skill folder, its description and its pin.
export function loadCatalogue(root) {
  const entries = JSON.parse(readFileSync(join(root, 'catalogue', 'catalogue.json'), 'utf8'));
  const folders = new Map();
  const plugins = join(root, 'plugins');
  for (const plugin of dirs(plugins)) {
    for (const name of dirs(join(plugins, plugin, 'skills'))) {
      const src = join(plugins, plugin, 'skills', name);
      if (existsSync(join(src, 'SKILL.md'))) folders.set(name, { src, group: plugin.replace(/^blueprint-/, '') });
    }
  }
  return entries.filter((e) => folders.has(e.id)).map((e) => {
    const { src, group } = folders.get(e.id);
    const fm = frontmatter(readFileSync(join(src, 'SKILL.md'), 'utf8'));
    return { ...e, src, group, description: fm.description ?? '' };
  });
}

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

export function searchSkills(skills, { query = '', tags = [] } = {}) {
  const q = words(query);
  const wantTags = tags.map((t) => t.toLowerCase());
  const scored = [];
  for (const s of skills) {
    if (wantTags.length && !wantTags.every((t) => s.tags.includes(t))) continue;
    let score = 0;
    const idWords = words(s.id);
    const descWords = words(s.description);
    for (const w of q) {
      if (idWords.includes(w)) score += 3;
      if (s.tags.includes(w)) score += 3;
      if (descWords.includes(w)) score += 1;
    }
    if (q.length && score === 0) continue;
    scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score || a.s.id.localeCompare(b.s.id));
  return scored.map(({ s, score }) => ({ id: s.id, group: s.group, tags: s.tags, description: s.description, score }));
}

// One scorer for the CLI and MCP: scripts/recommend.mjs. This adds the catalogue fields the tool returns.
export function recommendForRepo(skills, path) {
  const evidence = [...new Set(Object.values(detectStack(path).evidence).flat())];
  const byId = new Map(skills.map((s) => [s.id, s]));
  const recommendations = recommend(path, skills, { limit: skills.length })
    .filter((r) => byId.has(r.id))
    .map((r) => {
      const s = byId.get(r.id);
      return { id: r.id, group: s.group, tags: s.tags, description: s.description, score: r.score, evidence: r.evidence };
    });
  return { evidence, recommendations };
}
