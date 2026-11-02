import { finish, listFiles, readText, rootFromArgs } from './lib.mjs';
import { rank } from './routing-rank.mjs';

const root = rootFromArgs();
const problems = [];
const MIN_RANK1 = 0.9;

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

const files = listFiles(root);
const docs = [];
for (const f of files) {
  if (!/^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/.test(f)) continue;
  const fm = fields(readText(root, f));
  if (fm.name) docs.push({ name: fm.name, text: `${fm.name} ${fm.description ?? ''}` });
}
const names = new Set(docs.map((d) => d.name));

const routingFiles = files.filter((f) => /^routing\/[^/]+\.json$/.test(f));
const prompts = []; // { prompt, expected }
const seen = new Set();
for (const f of routingFiles) {
  let data;
  try {
    data = JSON.parse(readText(root, f));
  } catch (e) {
    problems.push(`${f}: not valid JSON`);
    continue;
  }
  const skill = data.skill;
  if (!names.has(skill)) {
    problems.push(`${f}: skill ${JSON.stringify(skill)} does not exist`);
    continue;
  }
  seen.add(skill);
  const positive = Array.isArray(data.positive) ? data.positive : [];
  const negative = Array.isArray(data.negative) ? data.negative : [];
  if (positive.length < 3) problems.push(`${f}: ${skill} has ${positive.length} positive prompts, needs 3`);
  if (negative.length < 2) problems.push(`${f}: ${skill} has ${negative.length} negative prompts, needs 2`);
  for (const p of positive) prompts.push({ prompt: p, expected: skill });
  for (const n of negative) {
    if (!names.has(n?.expect)) problems.push(`${f}: negative expect ${JSON.stringify(n?.expect)} does not exist`);
    else if (n.expect === skill) problems.push(`${f}: negative expect equals the skill ${skill}`);
    else prompts.push({ prompt: n.prompt, expected: n.expect });
  }
}
for (const name of names) {
  if (!seen.has(name) && !routingFiles.includes(`routing/${name}.json`)) problems.push(`${name}: no routing/${name}.json`);
}

if (prompts.length) {
  const misses = [];
  for (const p of prompts) {
    const got = rank(docs, p.prompt)[0];
    if (got !== p.expected) misses.push({ ...p, got });
  }
  const acc = (prompts.length - misses.length) / prompts.length;
  if (acc < MIN_RANK1) {
    problems.push(`rank-1 accuracy ${(acc * 100).toFixed(1)}% is under ${MIN_RANK1 * 100}%`);
    for (const m of misses) problems.push(`  miss: "${m.prompt}" expected ${m.expected}, got ${m.got}`);
  }
}

finish('check-routing', problems);
