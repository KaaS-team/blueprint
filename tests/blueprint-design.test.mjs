import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './helpers.mjs';
import { gateLine } from '../plugins/blueprint-design/skills/visual-check/scripts/gate-line.mjs';

const SKILLS = ['read-design', 'design-system-map', 'visual-check'];
const dir = (s) => join(ROOT, 'plugins', 'blueprint-design', 'skills', s);

test('blueprint-design has three skills, each under 120 lines with a Use when trigger', () => {
  for (const s of SKILLS) {
    const text = readFileSync(join(dir(s), 'SKILL.md'), 'utf8');
    assert.ok(text.split('\n').length < 120, `${s} is too long`);
    assert.match(text, /^description: Use when /m, `${s} has no trigger`);
  }
});

test('gate line: all pass', () => {
  const { line, code } = gateLine([{ name: 'A', pass: true }, { name: 'B', pass: true }]);
  assert.equal(line, 'FACTORY_GATES: status=PASS passed=2 failed=0 skipped=0 failed_gates=');
  assert.equal(code, 0);
});

test('gate line: a failure names the check and exits 1', () => {
  const { line, code } = gateLine([{ name: 'A', pass: true }, { name: 'Pricing Card', pass: false }, { name: 'C', skipped: true }]);
  assert.equal(line, 'FACTORY_GATES: status=FAIL passed=1 failed=1 skipped=1 failed_gates=Pricing-Card');
  assert.equal(code, 1);
});

test('gate line: empty or invalid input is MISCONFIGURED, never PASS', () => {
  assert.match(gateLine([]).line, /status=MISCONFIGURED/);
  assert.match(gateLine(null).line, /status=MISCONFIGURED/);
  assert.match(gateLine([{ name: 'A', skipped: true }]).line, /status=MISCONFIGURED/);
});

test('gate-line script reads a file and prints the line', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'gl-')), 'checks.json');
  writeFileSync(f, JSON.stringify([{ name: 'A', pass: true }]));
  const r = spawnSync('node', [join(dir('visual-check'), 'scripts', 'gate-line.mjs'), f], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^FACTORY_GATES: status=PASS passed=1/);
  const missing = spawnSync('node', [join(dir('visual-check'), 'scripts', 'gate-line.mjs'), f + '.no'], { encoding: 'utf8' });
  assert.equal(missing.status, 2);
});
