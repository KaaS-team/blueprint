import { spawnSync } from 'node:child_process';
import { finish, listFiles, readText, rootFromArgs } from './lib.mjs';

const root = rootFromArgs();
const problems = [];

// Reads the --- block and returns key: value pairs. List values stay as the raw string.
function fields(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const body = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();

const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

const files = listFiles(root);
const skills = new Map(); // group -> Set of skill names
for (const f of files) {
  const m = /^plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/.exec(f);
  if (m) {
    if (!skills.has(m[1])) skills.set(m[1], new Set());
    skills.get(m[1]).add(m[2]);
  }
}

// group/skill -> Map of case name -> files in that case folder
const cases = new Map();
for (const f of files) {
  const m = /^plugins\/([^/]+)\/evals\/([^/]+)\/(.+)$/.exec(f);
  if (!m) continue;
  const key = `${m[1]}/${m[2]}`;
  if (!cases.has(key)) cases.set(key, []);
  cases.get(key).push(f);
}

const covered = new Set(); // "group/skill"
for (const [key, caseFiles] of cases) {
  const [group, folder] = key.split('/');
  const skill = folder.split('--')[0];
  const label = `${group}/evals/${folder}`;
  if (!folder.includes('--') || !skills.get(group)?.has(skill)) {
    problems.push(`${label}: names no skill in ${group}`);
    continue;
  }
  covered.add(`${group}/${skill}`);
  const prefix = `plugins/${group}/evals/${folder}/`;
  const promptPath = `${prefix}prompt.md`;
  if (!caseFiles.includes(promptPath)) {
    problems.push(`${label}: no prompt.md`);
  } else {
    const text = readText(root, promptPath);
    if (!fields(text).max_turns) problems.push(`${label}: prompt.md has no max_turns`);
    if (!body(text)) problems.push(`${label}: prompt.md has an empty body`);
  }
  const graders = caseFiles
    .filter((f) => f.startsWith(`${prefix}graders/`) && f.endsWith('.md'))
    .map((f) => fields(readText(root, f)));
  if (!graders.some((g) => g.type === 'tool_used' && g.tool === 'Skill' && g.input_match === skill)) {
    problems.push(`${label}: no tool_used Skill grader for ${skill}`);
  }
  if (!graders.some((g) => g.type === 'regex' && g.pattern)) {
    problems.push(`${label}: no regex grader with a pattern`);
  }
}

for (const [group, set] of skills) {
  for (const skill of set) {
    if (!covered.has(`${group}/${skill}`)) problems.push(`${group}/${skill}: no eval case`);
  }
}

// The changed-case rule.
let base = process.env.EVAL_BASE;
if (!base) {
  const mb = git(['merge-base', 'HEAD', 'origin/main']);
  if (mb.status === 0) base = mb.stdout.trim();
  else if (git(['rev-parse', '--verify', '-q', 'HEAD^']).status === 0) base = 'HEAD^';
}
if (!base) {
  console.log('evals: no base, changed-case rule skipped');
} else {
  const diff = git(['diff', '--name-only', base]);
  if (diff.status !== 0) throw new Error(`git diff failed in ${root}: ${diff.stderr}`);
  const others = git(['ls-files', '--others', '--exclude-standard']);
  const changed = [...diff.stdout.split('\n'), ...others.stdout.split('\n')].filter(Boolean);
  const changedSkills = new Set();
  const changedCases = new Set();
  for (const f of changed) {
    let m = /^plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/.exec(f);
    if (m) changedSkills.add(m[2]);
    m = /^plugins\/([^/]+)\/evals\/([^/]+?)--[^/]+\/.+$/.exec(f);
    if (m) changedCases.add(m[2]);
  }
  for (const skill of changedSkills) {
    if (changedSkills.has(skill) && !changedCases.has(skill)) problems.push(`${skill}: SKILL.md changed with no eval change`);
  }
}

finish('evals', problems);
