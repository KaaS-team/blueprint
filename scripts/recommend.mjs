// Detects a repo's stack from files on disk and scores catalogue entries by tag.
// Detection ideas follow vercel/vercel packages/frameworks and github/linguist
// (dependency names and file extensions); no code is copied.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const UI_DEPS = ['react', 'react-dom', 'vue', 'svelte', 'next', 'nuxt', '@angular/core', 'solid-js', 'preact', 'astro', '@remix-run/react'];
const UI_EXT = /\.(tsx|jsx|vue|svelte|css|scss|sass|less)$/;
const UI_DIRS = ['components', 'pages'];
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.venv', 'target']);

const read = (dir, f) => {
  try { return readFileSync(join(dir, f), 'utf8'); } catch { return null; }
};

function walk(dir, depth, found) {
  if (depth > 4) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (UI_DIRS.includes(e.name) && !found.uiDir) found.uiDir = p;
      walk(p, depth + 1, found);
    } else if (UI_EXT.test(e.name) && !found.uiFile) found.uiFile = p;
  }
}

// Returns { traits: Set, evidence: { trait: [string] } }.
export function detectStack(dir) {
  const evidence = {};
  const add = (trait, why) => (evidence[trait] ??= []).push(why);

  const pkgText = read(dir, 'package.json');
  if (pkgText) {
    add('node', 'package.json');
    let pkg = {};
    try { pkg = JSON.parse(pkgText); } catch { /* unreadable package.json counts as plain node */ }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    for (const d of UI_DEPS) if (d in deps) add('ui', `package.json depends on ${d}`);
    for (const s of Object.keys(pkg.scripts ?? {})) {
      if (s === 'test') add('tests', 'package.json has a test script');
    }
    for (const d of ['vitest', 'jest', 'mocha']) if (d in deps) add('tests', `package.json depends on ${d}`);
  }
  const gomod = read(dir, 'go.mod');
  if (gomod) {
    add('go', 'go.mod');
    add('backend', 'go.mod (Go module)');
  }
  const py = read(dir, 'pyproject.toml') ?? read(dir, 'requirements.txt');
  if (py !== null) {
    add('python', existsSync(join(dir, 'pyproject.toml')) ? 'pyproject.toml' : 'requirements.txt');
    for (const w of ['fastapi', 'flask', 'django']) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(py)) add('backend', `Python dependency ${w}`);
    }
    if (/pytest/i.test(py)) add('tests', 'pytest configured');
  }
  if (read(dir, 'Cargo.toml') !== null) {
    add('rust', 'Cargo.toml');
    add('backend', 'Cargo.toml (Rust crate)');
  }
  if (existsSync(join(dir, '.github', 'workflows')) || existsSync(join(dir, '.gitlab-ci.yml'))) {
    add('ci', existsSync(join(dir, '.gitlab-ci.yml')) ? '.gitlab-ci.yml' : '.github/workflows');
  }
  if (existsSync(dir) && statSync(dir).isDirectory()) {
    const found = {};
    walk(dir, 0, found);
    if (found.uiDir) add('ui', `${found.uiDir.slice(dir.length + 1)}/ directory`);
    if (found.uiFile) add('ui', `${found.uiFile.slice(dir.length + 1)} (UI or CSS file)`);
  }
  if (!evidence.ui && (evidence.node || evidence.go || evidence.python || evidence.rust)) add('backend', 'no UI evidence found');
  return { traits: new Set(Object.keys(evidence)), evidence };
}

// A tag needs a trait to count. Tags not listed here fit any repo.
const NEEDS = { ui: 'ui', ci: 'ci', verify: null };
const BOOST = { ui: ['ui', 3], ci: ['ci', 2], verification: ['tests', 1], process: ['tests', 1] };

// entries: catalogue rows. Returns [{ id, kind, score, evidence }] best first.
export function recommend(dir, entries, { limit = 5 } = {}) {
  const { traits, evidence } = detectStack(dir);
  const rows = [];
  for (const e of entries) {
    const tags = e.tags ?? [];
    const why = [];
    let blocked = false;
    for (const t of tags) {
      if (NEEDS[t] && !traits.has(NEEDS[t])) blocked = true;
    }
    if (blocked) continue;
    let score = 1;
    for (const t of tags) {
      const b = BOOST[t];
      if (b && traits.has(b[0])) {
        score += b[1];
        why.push(...evidence[b[0]]);
      }
    }
    if (!why.length) why.push('fits any repo');
    rows.push({ id: e.id, kind: e.kind, score, evidence: [...new Set(why)] });
  }
  rows.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return rows.slice(0, limit);
}
