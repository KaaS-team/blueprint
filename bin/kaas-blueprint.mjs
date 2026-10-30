#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const EXIT_REFUSED = 1;
const EXIT_UNKNOWN = 2;

const AGENTS = {
  claude: '.claude/skills',
  codex: '.codex/skills',
  cursor: '.cursor/skills',
  pi: '.pi/skills',
  agents: '.agents/skills',
};

const USAGE = `Usage:
  kaas-blueprint list [--json] [--from <dir>]
  kaas-blueprint add <skill-or-group>... [--agent <name>] [--global] [--dir <path>] [--force] [--from <dir>]

Agents: ${Object.entries(AGENTS).map(([a, d]) => `${a} (${d})`).join(', ')}. Default: claude.
`;

const out = (text) => process.stdout.write(`${text}\n`);

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function usageError(message) {
  process.stderr.write(`${message}\n${USAGE}`);
  process.exit(EXIT_UNKNOWN);
}

function parse(argv) {
  const opts = { agent: 'claude', names: [] };
  const valued = { '--agent': 'agent', '--dir': 'dir', '--from': 'from' };
  const flags = { '--global': 'global', '--force': 'force', '--json': 'json' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valued[arg]) {
      if (i + 1 >= argv.length) usageError(`${arg} needs a value`);
      opts[valued[arg]] = argv[++i];
    } else if (flags[arg]) opts[flags[arg]] = true;
    else if (arg.startsWith('-')) usageError(`unknown flag ${arg}`);
    else opts.names.push(arg);
  }
  return opts;
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

// Returns rows of { name, group, src } and a Map from group short name to its skill names.
function catalog(root) {
  const rows = [];
  const groups = new Map();
  const plugins = join(root, 'plugins');
  const dirs = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
  for (const folder of dirs(plugins)) {
    const group = folder.replace(/^blueprint-/, '');
    for (const name of dirs(join(plugins, folder, 'skills'))) {
      const src = join(plugins, folder, 'skills', name);
      if (!existsSync(join(src, 'SKILL.md'))) continue;
      rows.push({ name, group, src });
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(name);
    }
  }
  rows.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  return { rows, groups };
}

const [command, ...rest] = process.argv.slice(2);
if (command !== 'list' && command !== 'add') usageError(command ? `unknown command ${command}` : 'no command given');
const opts = parse(rest);
if (!(opts.agent in AGENTS)) usageError(`unknown agent "${opts.agent}"`);
if (opts.dir && opts.global) usageError('--dir and --global cannot be used together');

const root = opts.from ? resolve(opts.from) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { rows: skills, groups } = catalog(root);

function list() {
  const rows = skills.map(({ name, group }) => ({ name, group }));
  if (opts.json) return out(JSON.stringify(rows, null, 2));
  for (const r of rows) out(`${r.name}\t${r.group}`);
}

if (command === 'list') {
  list();
  process.exit(0);
}

if (opts.names.length === 0) usageError('add needs at least one skill or group name');

const skillNames = skills.map((r) => r.name);
const resolveName = (name) => {
  if (groups.has(name)) return groups.get(name);
  if (skillNames.includes(name)) return [name];
  const known = [...skillNames, ...groups.keys()];
  const nearest = known.sort((a, b) => distance(name, a) - distance(name, b))[0];
  const hint = nearest ? `\ndid you mean "${nearest}"?` : '';
  fail(EXIT_UNKNOWN, `unknown skill or group "${name}"${hint}`);
};

const wanted = [...new Set(opts.names.flatMap(resolveName))];
const target = opts.dir ? resolve(opts.dir) : join(opts.global ? homedir() : process.cwd(), AGENTS[opts.agent]);

const clashes = [];
const plan = wanted.map((name) => {
  const src = skills.find((r) => r.name === name).src;
  const dest = join(target, name);
  if (existsSync(dest) && !opts.force) clashes.push(dest);
  return { name, src, dest };
});

if (clashes.length > 0) {
  fail(EXIT_REFUSED, `refusing to overwrite:\n${clashes.map((c) => `  ${c}`).join('\n')}\npass --force to replace them`);
}

mkdirSync(target, { recursive: true });
for (const { name, src, dest } of plan) {
  if (opts.force) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  out(`added ${name} to ${dest}`);
}
