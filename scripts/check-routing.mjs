import { finish, listFiles, readText, rootFromArgs } from './lib.mjs';

const root = rootFromArgs();
const problems = [];
const MIN_RATE = 0.9;
const MIN_PER_SKILL = 3;

const STOP = new Set('a an and are as at be by for from how i in is it its me my of on or the this to use user users using we when where which with you your will can any into than then that them they what'.split(' '));
const tokens = (s) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
// Crude suffix stemming so "grilling", "grill" and "reviewing", "review" meet.
function stem(w) {
  for (const suf of ['ing', 'es', 'ed', 's']) if (w.length > suf.length + 3 && w.endsWith(suf)) return w.slice(0, -suf.length);
  return w;
}

function description(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const d = m && /^description:\s*(.*)$/m.exec(m[1]);
  return d ? d[1] : '';
}

const files = listFiles(root);
const skills = []; // { id, group, name, tf }
for (const f of files) {
  const m = /^plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/.exec(f);
  if (!m) continue;
  const tf = new Map();
  // The name counts triple: it is the strongest routing signal a skill has.
  for (const t of [...tokens(description(readText(root, f))), ...tokens(m[2].replace(/-/g, ' ')).flatMap((t) => [t, t, t])]) tf.set(t, (tf.get(t) ?? 0) + 1);
  skills.push({ group: m[1], name: m[2], tf });
}

// Inverse document frequency over the skill descriptions: a word every skill shares routes nothing.
const df = new Map();
for (const s of skills) for (const t of s.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t) => Math.log(1 + skills.length / (df.get(t) ?? 1));

function pick(prompt) {
  let best = null;
  let bestScore = 0;
  let tie = false;
  const q = new Set(tokens(prompt));
  for (const s of skills) {
    let score = 0;
    for (const t of q) if (s.tf.has(t)) score += idf(t) * (1 + Math.log(s.tf.get(t)));
    if (score > bestScore) { best = s; bestScore = score; tie = false; }
    else if (score === bestScore && score > 0) tie = true;
  }
  return tie ? null : best;
}

const byGroup = new Map();
for (const s of skills) {
  if (!byGroup.has(s.group)) byGroup.set(s.group, new Set());
  byGroup.get(s.group).add(s.name);
}

// Each routing file maps a skill name to prompts that should reach it.
const cases = []; // { skill, prompt, where }
const seen = new Map();
for (const f of files) {
  const m = /^plugins\/([^/]+)\/evals\/routing\.json$/.exec(f);
  if (!m) continue;
  let data;
  try { data = JSON.parse(readText(root, f)); } catch (e) { problems.push(`${f}: not valid JSON`); continue; }
  for (const [skill, prompts] of Object.entries(data)) {
    if (!byGroup.get(m[1])?.has(skill) || !Array.isArray(prompts)) { problems.push(`${f}: ${skill} names no skill in ${m[1]} or has no prompt list`); continue; }
    seen.set(`${m[1]}/${skill}`, prompts.length);
    for (const p of prompts) cases.push({ skill, prompt: String(p), where: f });
  }
}

for (const s of skills) {
  const n = seen.get(`${s.group}/${s.name}`) ?? 0;
  if (n < MIN_PER_SKILL) problems.push(`${s.group}/${s.name}: ${n} routing prompt(s), needs ${MIN_PER_SKILL}`);
}

let hit = 0;
for (const c of cases) {
  const got = pick(c.prompt);
  if (got?.name === c.skill) hit++;
  else console.log(`miss: "${c.prompt}" wanted ${c.skill}, picked ${got?.name ?? 'nothing'}`);
}
if (cases.length) {
  const rate = hit / cases.length;
  console.log(`routing: ${hit}/${cases.length} picked first (${(rate * 100).toFixed(1)}%)`);
  if (rate < MIN_RATE) problems.push(`routing: ${(rate * 100).toFixed(1)}% picked first, needs ${MIN_RATE * 100}%`);
}

finish('routing', problems);
