#!/usr/bin/env node
// Copies blueprint skill folders into a coding agent's skills directory.
// Usage: blueprint add <skill|group>... [--agent <name>] [--global] [--dir <path>] [--force]
//        blueprint list [--json]
// Exit codes: 0 success, 1 refused or failed, 2 usage error or unknown name.
import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = ['core', 'review', 'ship'];
const AGENTS = {
  claude: '.claude/skills',
  codex: '.codex/skills',
  cursor: '.cursor/skills',
  pi: '.pi/skills',
  agents: '.agents/skills',
};

class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parse(argv) {
  const opts = { agent: 'claude', global: false, dir: null, force: false, json: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--global') opts.global = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--agent' || arg === '--dir') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new CliError(2, `${arg} needs a value`);
      opts[arg.slice(2)] = value;
    } else if (arg.startsWith('--')) throw new CliError(2, `unknown flag ${arg}`);
    else positional.push(arg);
  }
  return { command: positional[0], names: positional.slice(1), opts };
}

// Every skill folder in every group, ordered by group then name.
function catalogue() {
  return GROUPS.flatMap((group) => {
    const dir = join(ROOT, 'plugins', `blueprint-${group}`, 'skills');
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, group, source: join(dir, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function nearest(name, known) {
  return known.reduce((best, k) => (distance(name, k) < distance(name, best) ? k : best));
}

// Resolves every name before anything is copied, so one unknown name copies nothing.
function resolveNames(names, skills) {
  const known = [...GROUPS, ...skills.map((s) => s.name)];
  const unknown = names.filter((n) => !known.includes(n));
  if (unknown.length) {
    const hints = unknown.map((n) => `"${n}" (did you mean "${nearest(n, known)}"?)`);
    throw new CliError(2, `unknown name ${hints.join(', ')}; nothing was copied`);
  }
  const chosen = new Map();
  for (const n of names) {
    const members = GROUPS.includes(n) ? skills.filter((s) => s.group === n) : skills.filter((s) => s.name === n);
    for (const s of members) chosen.set(s.name, s);
  }
  return [...chosen.values()];
}

function targetDir(opts) {
  if (!opts.dir && !Object.hasOwn(AGENTS, opts.agent)) {
    throw new CliError(2, `unknown agent "${opts.agent}"; use one of ${Object.keys(AGENTS).join(', ')}`);
  }
  if (opts.dir) return resolve(process.cwd(), opts.dir);
  return join(opts.global ? homedir() : process.cwd(), AGENTS[opts.agent]);
}

function list(names, opts) {
  if (names.length) throw new CliError(2, 'list takes no names');
  const skills = catalogue();
  if (opts.json) {
    console.log(JSON.stringify(skills.map(({ name, group }) => ({ name, group })), null, 2));
    return 0;
  }
  const width = Math.max(0, ...skills.map((s) => s.name.length));
  for (const { name, group } of skills) console.log(`${name.padEnd(width)}  ${group}`);
  return 0;
}

// True when a and b are the same folder or one is inside the other.
function overlaps(a, b) {
  const inside = (parent, child) => {
    const rel = relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  };
  return inside(real(a), real(b)) || inside(real(b), real(a));
}

// Resolves symlinks in the part of p that exists, so /var and /private/var compare equal.
function real(p) {
  if (existsSync(p)) return realpathSync(p);
  const parent = dirname(p);
  return parent === p ? p : join(real(parent), basename(p));
}

function add(names, opts) {
  if (names.length === 0) throw new CliError(2, 'add needs at least one skill or group name');
  const selected = resolveNames(names, catalogue());
  if (selected.length === 0) throw new CliError(1, `nothing to copy: ${names.join(', ')} has no skills`);
  const target = targetDir(opts);
  // Check every target before copying any, so a refusal leaves the target untouched.
  for (const s of selected) {
    const dest = join(target, s.name);
    if (overlaps(dest, s.source)) throw new CliError(1, `${dest} is the source skill or inside it or contains it; pick another --dir`);
    if (!opts.force && existsSync(dest)) throw new CliError(1, `${dest} already exists; pass --force to replace it`);
  }
  mkdirSync(target, { recursive: true });
  for (const s of selected) {
    const dest = join(target, s.name);
    // Copy beside the target first, so a failed copy never costs the skill already installed.
    const staged = `${dest}.blueprint-tmp`;
    rmSync(staged, { recursive: true, force: true });
    cpSync(s.source, staged, { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    renameSync(staged, dest);
    console.log(`copied ${s.name} (${s.group}) to ${dest}`);
  }
  return 0;
}

function run(argv) {
  const { command, names, opts } = parse(argv);
  if (command === 'add') return add(names, opts);
  if (command === 'list') return list(names, opts);
  throw new CliError(2, 'usage: blueprint add <skill|group>... | blueprint list [--json]');
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (err) {
  if (!(err instanceof CliError)) throw err;
  console.error(`blueprint: ${err.message}`);
  process.exitCode = err.code;
}
