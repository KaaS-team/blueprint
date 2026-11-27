import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { BANNED, COMMAND, DEFAULT_ROOT, DOMAIN } from './lib.mjs';

// Usage: import-kit.mjs <kit-plugin-dir> [--out <root>] [--names <file>]
// --names is a private JSON file kept outside this public repo, so client names are never spelled here:
//   { "rewrite": [["literal text", "neutral text"], ...], "ban": ["client-name", ...] }
// Each rewrite runs before the line check; a banned name left after them drops its line, and one left in
// the output stops the import like the company name does.
const args = process.argv.slice(2);
const opt = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? resolve(args.splice(i, 2)[1]) : null;
};
const outRoot = opt('--out') ?? DEFAULT_ROOT;
const namesFile = opt('--names');
const kit = args[0];
if (!kit) {
  console.error('usage: import-kit.mjs <kit-plugin-dir> [--out <root>] [--names <file>]');
  process.exit(2);
}
const names = namesFile ? JSON.parse(readFileSync(namesFile, 'utf8')) : {};
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CLIENT = names.ban?.length ? new RegExp(`(?<![a-z0-9])(?:${names.ban.map(escape).join('|')})(?![a-z0-9])`, 'i') : null;
const leaks = (text) => {
  const t = text.replace(DOMAIN, '').replace(COMMAND, '');
  return BANNED.test(t) || (CLIENT !== null && CLIENT.test(t));
};

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

// Company names the kit uses in paths and phrases, rewritten to neutral words so the sentence
// survives. Client names come from --names. Any name left is dropped with its line, and a leak throws.
const REWRITES = [
  [/scripts\/kaas\//g, 'scripts/'],
  [/\.claude\/rules\/kaas-/g, '.claude/rules/'],
  [/\bthe kaas (engineering standard|kit)\b/gi, 'the $1'],
  [/\$KAAS_WORKSPACE\b/g, '$WORKSPACE'],
  [/\bin\nlearnwithparam are\b/g, 'in\none repo are'],
  [/\bin lwp-website\b/g, 'in another'],
  // Not a name: "failure" here pulled a generic debugging request away from systematic-debugging.
  [/a pasted Playwright failure\./g, 'a pasted Playwright trace.'],
];
// Sections that only hold private repo data, dropped from the heading to the next heading of that level.
const DROP_SECTIONS = ['## Known baseline'];
const dropSections = (text) =>
  DROP_SECTIONS.reduce((t, h) => t.replace(new RegExp(`^${h}\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm'), ''), text);
const scrub = (text) =>
  (names.rewrite ?? []).reduce((t, [from, to]) => t.split(from).join(to), REWRITES.reduce((t, [re, to]) => t.replace(re, to), dropSections(text)));

// A "Use when" clause for the kit skills whose description has none, so the skill can be routed.
const TRIGGERS = new Map([
  ['intent', 'Use when a change needs its problem written down before code, or a finding must outlive the session.'],
  ['structural-test', 'Use when a rule should hold across every route, table or file, or a check exists but nothing runs it.'],
  ['repo-audit', 'Use when asked how a repo scores against the standard, or what it is missing.'],
]);
const withTrigger = (line, name) => {
  if (line.includes('Use when') || !TRIGGERS.has(name)) return line;
  const m = /^(description:\s*)"(.*)"\s*$/.exec(line);
  return m ? `${m[1]}"${m[2]} ${TRIGGERS.get(name)}"` : `${line} ${TRIGGERS.get(name)}`;
};

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
  const { fm, body } = split(scrub(text));
  let head = null;
  if (fm !== null) {
    const lines = fm.split(/\r?\n/).filter((l) => !/^model:/.test(l)).map((l) => {
      if (/^name:/.test(l)) return `name: ${name}`;
      if (/^description:/.test(l)) return withTrigger(l.replace('Use for ', 'Use when asked for '), name);
      return l;
    });
    head = renameRefs(lines.join('\n'));
  }
  const kept = [];
  renameRefs(body).split('\n').forEach((line, i) => {
    const bad = leaks(line) || line.includes('~/') || line.includes('/Users/');
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
  if (leaks(out)) throw new Error(`${target}: still names the company`);
  rendered.push([target, out.endsWith('\n') ? out : `${out}\n`]);
}
for (const [target, out] of rendered) {
  mkdirSync(dirname(join(outRoot, target)), { recursive: true });
  writeFileSync(join(outRoot, target), out);
  console.log(`wrote ${target}`);
}
