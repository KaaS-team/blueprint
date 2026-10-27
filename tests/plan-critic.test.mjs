import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers.mjs';

const SKILL_DIR = join(ROOT, 'plugins', 'blueprint-review', 'skills', 'plan-critic');
const SCRIPT = join(SKILL_DIR, 'scripts', 'check-plan.mjs');
const FIXTURES = join(SKILL_DIR, 'fixtures');
const { verdict } = await import(pathToFileURL(SCRIPT).href);

// Runs the script on a plan file from the repo root, so file-existence checks resolve the same way in the mutation copy.
function runCheck(file) {
  const r = spawnSync(process.execPath, [SCRIPT, file], { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status, result: JSON.parse(r.stdout) };
}

function checkText(text) {
  const dir = mkdtempSync(join(tmpdir(), 'plan-critic-'));
  const file = join(dir, 'PLAN.md');
  writeFileSync(file, text);
  return runCheck(file);
}

const GOOD = { size: 'S', depends: 'none', files: 'src/a.mjs (new)', verify: 'the unit test passes' };
const task = (id, fields) => {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `- ${key}: ${value}`);
  return [`## ${id}: Do a thing`, ...lines].join('\n');
};
const plan = (...tasks) => `${tasks.join('\n\n')}\n`;
const rules = (result) => result.findings.map((f) => f.rule);

test('SKILL.md is named plan-critic and its description starts with Use when', () => {
  const text = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(text, /^name: plan-critic$/m);
  const description = /^description: (.*)$/m.exec(text);
  assert.ok(description, 'SKILL.md has a description line');
  assert.ok(description[1].startsWith('Use when'), description[1]);
});

test('the script imports only node: built-ins', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  for (const [, specifier] of source.matchAll(/^import .* from '([^']+)';$/gm)) {
    assert.ok(specifier.startsWith('node:'), `non-built-in import ${specifier}`);
  }
});

test('a complete plan passes with exit 0 and an empty findings list', () => {
  const { code, result } = checkText(plan(task('T1', GOOD), task('T2', { ...GOOD, depends: 'T1' })));
  assert.equal(code, 0);
  assert.deepEqual(result, { ok: true, findings: [] });
});

test('rule no-tasks fires on a plan with no task headings', () => {
  const { code, result } = checkText('# Plan\n\nJust prose, no tasks.\n');
  assert.equal(code, 1);
  assert.deepEqual(rules(result), ['no-tasks']);
});

test('verdict counts a string, fractional or out-of-range score as 0', () => {
  const ok = { intent: 2, scope: 2, verification: 2, risk: 2, estimate: 2 };
  for (const bad of ['2', 1.5, 3, -1, null, NaN]) {
    assert.equal(verdict({ findings: [], scores: { ...ok, risk: bad }, round: 1 }), 'REVISE', String(bad));
  }
  assert.equal(verdict({ findings: [], scores: { ...ok, risk: 5, estimate: 5, scope: 5 }, round: 1 }), 'REVISE');
});

test('rule no-verify fires on a task with no verify line', () => {
  const { code, result } = checkText(plan(task('T1', { ...GOOD, verify: undefined })));
  assert.equal(code, 1);
  assert.equal(result.ok, false);
  assert.ok(rules(result).includes('no-verify'), JSON.stringify(result));
  assert.equal(result.findings[0].task, 'T1');
});

test('rule no-size fires on a task with no size', () => {
  const { result } = checkText(plan(task('T1', { ...GOOD, size: undefined })));
  assert.ok(rules(result).includes('no-size'), JSON.stringify(result));
});

test('rule unknown-dependency fires when a task depends on a missing task id', () => {
  const { result } = checkText(plan(task('T1', { ...GOOD, depends: 'T9' })));
  assert.ok(rules(result).includes('unknown-dependency'), JSON.stringify(result));
});

test('rule cycle fires on every task in a dependency cycle', () => {
  const { result } = checkText(plan(task('T1', { ...GOOD, depends: 'T2' }), task('T2', { ...GOOD, depends: 'T1' })));
  const cyclic = result.findings.filter((f) => f.rule === 'cycle').map((f) => f.task);
  assert.deepEqual(cyclic, ['T1', 'T2']);
});

test('rule unknown-file fires on a file that is neither present nor marked new', () => {
  const { result } = checkText(plan(task('T1', { ...GOOD, files: 'src/missing-file.mjs' })));
  assert.ok(rules(result).includes('unknown-file'), JSON.stringify(result));
});

test('rule placeholder fires on TBD, TODO, ??? and FIXME', () => {
  for (const word of ['TBD', 'TODO', '???', 'FIXME']) {
    const { result } = checkText(plan(task('T1', { ...GOOD, verify: `check ${word} later` })));
    assert.ok(rules(result).includes('placeholder'), `${word}: ${JSON.stringify(result)}`);
  }
});

test('verdict is PASS when there are no findings, every item is at least 1 and the total is 8 or more', () => {
  const scores = { intent: 2, scope: 2, verification: 2, risk: 1, estimate: 1 };
  assert.equal(verdict({ findings: [], scores, round: 1 }), 'PASS');
});

test('verdict is REVISE on round 1 when a finding is present', () => {
  const scores = { intent: 2, scope: 2, verification: 2, risk: 2, estimate: 2 };
  assert.equal(verdict({ findings: [{ rule: 'no-size' }], scores, round: 1 }), 'REVISE');
});

test('verdict is BLOCK on round 2 when the plan still fails', () => {
  const scores = { intent: 2, scope: 2, verification: 2, risk: 2, estimate: 2 };
  assert.equal(verdict({ findings: [{ rule: 'no-size' }], scores, round: 2 }), 'BLOCK');
});

test('verdict is REVISE when one item scores 0 even with a total of 8', () => {
  const scores = { intent: 2, scope: 0, verification: 2, risk: 2, estimate: 2 };
  assert.equal(verdict({ findings: [], scores, round: 1 }), 'REVISE');
});

test('verdict treats a total of exactly 8 as a pass and 7 as a fail', () => {
  assert.equal(verdict({ findings: [], scores: { intent: 2, scope: 2, verification: 2, risk: 1, estimate: 1 }, round: 1 }), 'PASS');
  assert.equal(verdict({ findings: [], scores: { intent: 2, scope: 2, verification: 1, risk: 1, estimate: 1 }, round: 1 }), 'REVISE');
});

test('fixture clean passes the script with ok true', () => {
  const { code, result } = runCheck(join(FIXTURES, 'clean.md'));
  assert.equal(code, 0);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('fixture clean gives PASS from its rubric scores', () => {
  const scores = JSON.parse(readFileSync(join(FIXTURES, 'clean.scores.json'), 'utf8'));
  assert.equal(verdict({ findings: [], scores, round: 1 }), 'PASS');
});

test('fixture no-verification fails the script with the no-verify rule', () => {
  const { code, result } = runCheck(join(FIXTURES, 'no-verification.md'));
  assert.equal(code, 1);
  assert.equal(result.ok, false);
  assert.ok(rules(result).includes('no-verify'), JSON.stringify(result));
});

test('fixture cycle fails the script with the cycle rule', () => {
  const { code, result } = runCheck(join(FIXTURES, 'cycle.md'));
  assert.equal(code, 1);
  assert.equal(result.ok, false);
  assert.ok(rules(result).includes('cycle'), JSON.stringify(result));
});

test('fixture scope-creep passes the script, then REVISE on round 1 and BLOCK on round 2', () => {
  const { code, result } = runCheck(join(FIXTURES, 'scope-creep.md'));
  assert.equal(code, 0);
  assert.equal(result.ok, true, JSON.stringify(result));
  const scores = JSON.parse(readFileSync(join(FIXTURES, 'scope-creep.scores.json'), 'utf8'));
  assert.equal(verdict({ findings: result.findings, scores, round: 1 }), 'REVISE');
  assert.equal(verdict({ findings: result.findings, scores, round: 2 }), 'BLOCK');
});
