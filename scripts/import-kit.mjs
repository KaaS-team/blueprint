import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { BANNED, COMMAND, DEFAULT_ROOT, DOMAIN } from './lib.mjs';

// Usage: import-kit.mjs <kit-plugin-dir> [--out <root>]
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outRoot = outIdx >= 0 ? resolve(args.splice(outIdx, 2)[1]) : DEFAULT_ROOT;
const kit = args[0];
if (!kit) {
  console.error('usage: import-kit.mjs <kit-plugin-dir> [--out <root>]');
  process.exit(2);
}

const MAP = [
  ['skills/eng-intent/SKILL.md', 'plugins/blueprint-core/skills/intent/SKILL.md'],
  ['skills/eng-debug-e2e/SKILL.md', 'plugins/blueprint-core/skills/debug-e2e/SKILL.md'],
  ['skills/eng-add-dependency/SKILL.md', 'plugins/blueprint-review/skills/add-dependency/SKILL.md'],
  ['skills/eng-new-guard/SKILL.md', 'plugins/blueprint-review/skills/structural-test/SKILL.md'],
  ['skills/eng-audit-repo/SKILL.md', 'plugins/blueprint-review/skills/repo-audit/SKILL.md'],
  ['skills/eng-impact-map/SKILL.md', 'plugins/blueprint-ship/skills/impact-map/SKILL.md'],
  ['skills/eng-ship/SKILL.md', 'plugins/blueprint-ship/skills/ship/SKILL.md'],
  ['agents/verifier.md', 'plugins/blueprint-core/agents/verifier.md'],
  ['agents/complexity-surgeon.md', 'plugins/blueprint-review/agents/complexity-surgeon.md'],
  ['agents/gate-triage.md', 'plugins/blueprint-ship/agents/gate-triage.md'],
  ['engineering.md', 'plugins/blueprint-core/rules/engineering.md'],
  ['rules/kaas-comments.md', 'plugins/blueprint-core/rules/comments.md'],
];
// Sources whose body is appended to a mapped target under a heading.
const MERGES = [
  ['skills/verify/SKILL.md', 'plugins/blueprint-ship/skills/ship/SKILL.md', '## Verify'],
  ['agents/structural-test-author.md', 'plugins/blueprint-review/skills/structural-test/SKILL.md', '## Structural test author'],
];

// kit skill name -> blueprint name
const NAMES = new Map(
  MAP.filter(([s]) => s.startsWith('skills/')).map(([s, t]) => [s.split('/')[1], t.split('/')[3]]),
);
NAMES.set('verify', 'ship');

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const split = (text) => {
  const m = FM.exec(text);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: null, body: text };
};

function renameRefs(text) {
  let t = text;
  for (const [kit, bp] of NAMES) t = t.split(`kaas-eng:${kit}`).join(bp);
  for (const [kit, bp] of NAMES) if (kit !== 'verify') t = t.replace(new RegExp(`\\b${kit}\\b`, 'g'), bp);
  return t;
}

function rewrite(text, target, name) {
  const { fm, body } = split(text);
  let head = null;
  if (fm !== null) {
    const lines = fm.split(/\r?\n/).filter((l) => !/^model:/.test(l)).map((l) => {
      if (/^name:/.test(l)) return `name: ${name}`;
      if (/^description:/.test(l)) return l.replace('Use for ', 'Use when asked for ');
      return l;
    });
    head = renameRefs(lines.join('\n'));
  }
  const kept = [];
  renameRefs(body).split('\n').forEach((line, i) => {
    const bad = BANNED.test(line.replace(DOMAIN, '').replace(COMMAND, '')) || line.includes('~/') || line.includes('/Users/');
    if (bad) console.error(`dropped ${target}:${i + 1}: ${line}`);
    else kept.push(line);
  });
  return { head, body: kept.join('\n') };
}

const stem = (target) => (target.endsWith('/SKILL.md') ? target.split('/').at(-2) : target.split('/').at(-1).replace(/\.md$/, ''));
const read = (src) => {
  const path = join(kit, src);
  if (existsSync(path)) return readFileSync(path, 'utf8');
  console.error(`missing ${src}`);
  return null;
};

const outputs = new Map();
for (const [src, target] of MAP) {
  const text = read(src);
  if (text === null) continue;
  const { head, body } = rewrite(text, target, stem(target));
  outputs.set(target, { head, body });
}
for (const [src, target, heading] of MERGES) {
  const text = read(src);
  if (text === null || !outputs.has(target)) continue;
  const { body } = rewrite(text, target, stem(target));
  const o = outputs.get(target);
  o.body = `${o.body.replace(/\s+$/, '')}\n\n${heading}\n\n${body.replace(/^\s+/, '')}`;
}

// Build every output first, guard each, and only then write.
const rendered = [];
for (const [target, { head, body }] of outputs) {
  const out = head === null ? body : `---\n${head}\n---\n${body}`;
  if (BANNED.test(out.replace(DOMAIN, '').replace(COMMAND, ''))) throw new Error(`${target}: still names the company`);
  rendered.push([target, out.endsWith('\n') ? out : `${out}\n`]);
}
for (const [target, out] of rendered) {
  mkdirSync(dirname(join(outRoot, target)), { recursive: true });
  writeFileSync(join(outRoot, target), out);
  console.log(`wrote ${target}`);
}
