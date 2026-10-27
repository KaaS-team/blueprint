// Checks a plan file against the format in SKILL.md and prints {ok, findings[]} as JSON.
// Imports only node: built-ins, so it runs anywhere node does and calls no model.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The five rubric items the agent scores 0 to 2. verdict() reads them by these keys.
export const RUBRIC = ['intent', 'scope', 'verification', 'risk', 'estimate'];
const SIZES = ['S', 'M', 'L'];
const TASK = /^## (T\d+):\s*(.*)$/;
const FIELD = /^- (\w+):\s*(.*)$/;
const PLACEHOLDER = /\b(TBD|TODO|FIXME)\b|\?\?\?/;

function depsOf(fields) {
  return (fields.depends ?? '').split(',').map((s) => s.trim()).filter((s) => s && s !== 'none');
}

// Returns the ids of the tasks that sit on a dependency cycle, found by a depth-first walk over the known dependencies.
function cycleMembers(tasks, ids) {
  const graph = new Map(tasks.map((t) => [t.id, depsOf(t.fields).filter((d) => ids.has(d))]));
  const state = new Map();
  const stack = [];
  const members = new Set();
  const visit = (id) => {
    state.set(id, 'visiting');
    stack.push(id);
    for (const dep of graph.get(id)) {
      if (state.get(dep) === 'visiting') {
        for (const member of stack.slice(stack.indexOf(dep))) members.add(member);
      } else if (!state.has(dep)) {
        visit(dep);
      }
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const { id } of tasks) if (!state.has(id)) visit(id);
  return tasks.map((t) => t.id).filter((id) => members.has(id));
}

// Checks the plan text. Paths in `files` are resolved against cwd, so a file must exist from there or be marked (new).
export function checkPlan(text, cwd = process.cwd()) {
  const tasks = [];
  const findings = [];
  let current = null;
  text.split(/\r?\n/).forEach((line, index) => {
    const heading = TASK.exec(line);
    const field = FIELD.exec(line);
    if (heading) {
      current = { id: heading[1], fields: {} };
      tasks.push(current);
    } else if (current && field) {
      current.fields[field[1]] = field[2].trim();
    }
    if (PLACEHOLDER.test(line)) {
      findings.push({ task: current?.id ?? null, rule: 'placeholder', message: `line ${index + 1} has a placeholder` });
    }
  });

  if (tasks.length === 0) findings.push({ task: null, rule: 'no-tasks', message: 'has no "## T<n>:" task headings, so nothing was checked' });
  const ids = new Set(tasks.map((t) => t.id));
  for (const task of tasks) {
    const { fields } = task;
    const files = (fields.files ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((raw) => ({
      path: raw.replace(/\s*\(new\)$/, ''),
      isNew: /\(new\)$/.test(raw),
    }));
    if (!fields.verify) findings.push({ task: task.id, rule: 'no-verify', message: 'has no verify line: no test or acceptance criterion' });
    if (!SIZES.includes(fields.size)) findings.push({ task: task.id, rule: 'no-size', message: 'has no size of S, M or L' });
    for (const dep of depsOf(fields)) {
      if (!ids.has(dep)) findings.push({ task: task.id, rule: 'unknown-dependency', message: `depends on ${dep}, which is not a task` });
    }
    for (const entry of files) {
      if (!entry.isNew && !existsSync(resolve(cwd, entry.path))) {
        findings.push({ task: task.id, rule: 'unknown-file', message: `${entry.path} is not present and is not marked (new)` });
      }
    }
  }
  for (const id of cycleMembers(tasks, ids)) {
    findings.push({ task: id, rule: 'cycle', message: `${id} is part of a dependency cycle` });
  }
  return { ok: findings.length === 0, findings };
}

// Turns the findings and the rubric scores into PASS, REVISE or BLOCK. Pure: it only reads its arguments.
// PASS needs no findings, every item at 1 or more and a total of 8 or more. A failure on round 1 is REVISE, on round 2 BLOCK.
export function verdict({ findings = [], scores = {}, round = 1 } = {}) {
  // A score that is not an integer from 0 to 2 is invalid and counts as 0, so it cannot lift the total.
  const items = RUBRIC.map((key) => (Number.isInteger(scores[key]) && scores[key] >= 0 && scores[key] <= 2 ? scores[key] : 0));
  const total = items.reduce((sum, score) => sum + score, 0);
  const pass = findings.length === 0 && items.every((score) => score >= 1) && total >= 8;
  if (pass) return 'PASS';
  return round >= 2 ? 'BLOCK' : 'REVISE';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: check-plan.mjs PLAN.md');
    process.exitCode = 2;
  } else {
    const result = checkPlan(readFileSync(file, 'utf8'));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  }
}
