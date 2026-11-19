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

// Signals that a repo gives. Each signal adds query words and tags to rank by.
const SIGNALS = [
  { file: 'go.mod', stack: 'go', words: ['test', 'review', 'verification', 'debugging'] },
  { file: 'package.json', stack: 'node', words: ['test', 'review', 'design', 'ui'] },
  { file: 'pyproject.toml', stack: 'python', words: ['test', 'review', 'verification', 'debugging'] },
  { file: 'Cargo.toml', stack: 'rust', words: ['test', 'review', 'verification', 'debugging'] },
];

function ciFiles(path) {
  const found = [];
  const wf = join(path, '.github', 'workflows');
  if (existsSync(wf)) for (const f of readdirSync(wf)) if (/\.ya?ml$/.test(f)) found.push(`.github/workflows/${f}`);
  for (const f of ['.gitlab-ci.yml', 'Jenkinsfile', '.circleci/config.yml']) if (existsSync(join(path, f))) found.push(f);
  return found;
}

export function recommendForRepo(skills, path) {
  const evidence = [];
  const want = new Map();
  const add = (w, n) => want.set(w, (want.get(w) ?? 0) + n);
  for (const sig of SIGNALS) {
    if (!existsSync(join(path, sig.file))) continue;
    evidence.push(sig.file);
    for (const w of sig.words) add(w, 2);
    if (sig.stack === 'node') {
      const pkg = JSON.parse(readFileSync(join(path, sig.file), 'utf8'));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      if (deps.some((d) => /react|vue|svelte|next|tailwind/.test(d))) { add('design', 3); add('ui', 3); }
    }
  }
  const ci = ciFiles(path);
  if (ci.length) {
    evidence.push(...ci);
    add('ci', 3); add('ship', 3); add('verification', 2);
  }
  const ranked = skills.map((s) => {
    let score = 0;
    for (const [w, n] of want) {
      if (s.tags.includes(w) || words(s.id).includes(w)) score += n;
      else if (words(s.description).includes(w)) score += 1;
    }
    return { id: s.id, group: s.group, tags: s.tags, description: s.description, score };
  });
  // Skills that apply to any stack keep a small base score so the list is never empty.
  const baseline = new Set(['verification-before-completion', 'systematic-debugging', 'code-review-and-quality']);
  for (const r of ranked) if (baseline.has(r.id)) r.score += 1;
  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { evidence, recommendations: ranked.filter((r) => r.score > 0) };
}
