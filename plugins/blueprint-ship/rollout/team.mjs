// Sets up one team's coding agents the same way. Used by `kaas-blueprint init --team`.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACK = join(HERE, '..');
export const TARGETS = ['claude', 'cursor', 'codex', 'gemini'];

const START = '<!-- kaas-blueprint:team start -->';
const END = '<!-- kaas-blueprint:team end -->';
const POINTER = '@AGENTS.md';
const HOOK_DIR = '.claude/blueprint-ship/hooks';

const read = (p) => readFileSync(p, 'utf8');

function rulesText() {
  const dir = join(PACK, 'rules');
  const parts = readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => read(join(dir, f)).trim().replace(/^# /m, '## '));
  return `# Team rules\n\n${parts.join('\n\n')}`;
}

const block = () => `${START}\n${rulesText()}\n${END}`;

// Replaces the managed block, or appends it. Text outside the block is never touched.
function mergeBlock(existing, body) {
  if (existing === null) return `${body}\n`;
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s !== -1 && e > s) return existing.slice(0, s) + body + existing.slice(e + END.length);
  return `${existing.replace(/\n*$/, '\n\n')}${body}\n`;
}

const union = (a = [], b = []) => [...a, ...b.filter((x) => !a.includes(x))];

function mergeSettings(existing) {
  const ours = JSON.parse(read(join(HERE, 'managed-settings.json')));
  const cmd = (name) => `node "$CLAUDE_PROJECT_DIR/${HOOK_DIR}/${name}.mjs"`;
  const out = existing ? structuredClone(existing) : {};
  if (out.awaySummaryEnabled === undefined) out.awaySummaryEnabled = ours.awaySummaryEnabled;
  out.env = { ...ours.env, ...(out.env ?? {}) };
  out.permissions = out.permissions ?? {};
  out.permissions.allow = union(out.permissions.allow, ours.permissions.allow);
  out.permissions.deny = union(out.permissions.deny, ours.permissions.deny);
  out.hooks = out.hooks ?? {};
  for (const [event, entries] of Object.entries(ours.hooks)) {
    const list = (out.hooks[event] = out.hooks[event] ?? []);
    for (const entry of entries) {
      const name = entry.hooks[0].command.match(/([\w-]+)\.mjs/)[1];
      const mine = { ...entry, hooks: [{ ...entry.hooks[0], command: cmd(name) }] };
      const has = list.some((e) => (e.hooks ?? []).some((h) => h.command === mine.hooks[0].command));
      if (!has) list.push(mine);
    }
  }
  return out;
}

function mergeGemini(existing) {
  const out = existing ? structuredClone(existing) : {};
  out.context = out.context ?? {};
  const cur = out.context.fileName;
  const names = Array.isArray(cur) ? cur : cur ? [cur] : [];
  out.context.fileName = union(names, ['AGENTS.md']);
  return out;
}

const readJson = (p, rel) => {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(read(p));
  } catch {
    throw new Error(`${rel} is not valid JSON; fix it first, nothing was written`);
  }
};

// Returns the files that would change: [{ path, content, action: 'create' | 'update' }].
export function planTeam(repo, targets = TARGETS) {
  const want = new Set(targets);
  const changes = [];
  const put = (path, content) => {
    const full = join(repo, path);
    const had = existsSync(full);
    if (had && read(full) === content) return;
    changes.push({ path, content, action: had ? 'update' : 'create' });
  };
  const text = (path) => (existsSync(join(repo, path)) ? read(join(repo, path)) : null);
  const json = (path, obj) => put(path, `${JSON.stringify(obj, null, 2)}\n`);

  // AGENTS.md is the shared base. Codex and Gemini read it, so every target needs it.
  put('AGENTS.md', mergeBlock(text('AGENTS.md'), block()));

  if (want.has('claude')) {
    const claude = text('CLAUDE.md');
    if (claude === null) put('CLAUDE.md', `${POINTER}\n`);
    else if (!claude.split('\n').some((l) => l.trim() === POINTER)) put('CLAUDE.md', `${claude.replace(/\n*$/, '\n')}\n${POINTER}\n`);
    json('.claude/settings.json', mergeSettings(readJson(join(repo, '.claude/settings.json'), '.claude/settings.json')));
    for (const f of readdirSync(join(HERE, 'hooks'))) put(`${HOOK_DIR}/${f}`, read(join(HERE, 'hooks', f)));
  }
  if (want.has('cursor')) {
    const path = '.cursor/rules/kaas-blueprint.mdc';
    const head = '---\ndescription: Team rules from kaas-blueprint\nalwaysApply: true\n---\n\n';
    const cur = text(path);
    put(path, cur === null ? `${head}${block()}\n` : mergeBlock(cur, block()));
  }
  if (want.has('gemini')) {
    json('.gemini/settings.json', mergeGemini(readJson(join(repo, '.gemini/settings.json'), '.gemini/settings.json')));
  }
  return changes;
}

export function applyTeam(repo, changes) {
  for (const { path, content } of changes) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}
