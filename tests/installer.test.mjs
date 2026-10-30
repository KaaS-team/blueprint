import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, fixture } from './helpers.mjs';

const BIN = join(ROOT, 'bin', 'kaas-blueprint.mjs');
const src = () =>
  fixture({
    'plugins/blueprint-core/skills/alpha/SKILL.md': '# alpha\n',
    'plugins/blueprint-review/skills/beta/SKILL.md': '# beta\n',
    'plugins/blueprint-review/skills/beta/scripts/run.mjs': 'export {};\n',
    'plugins/blueprint-review/skills/gamma/SKILL.md': '# gamma\n',
  });
const tmp = () => mkdtempSync(join(tmpdir(), 'installer-'));

function run(args, { cwd, env, from } = {}) {
  const argv = [BIN, ...args, ...(from ? ['--from', from] : [])];
  const r = spawnSync(process.execPath, argv, { cwd: cwd ?? tmp(), env: { ...process.env, ...env }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('add copies the whole skill folder into --dir', () => {
  const from = src();
  const dir = tmp();
  const r = run(['add', 'beta', '--dir', dir], { from });
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(dir, 'beta/SKILL.md')));
  assert.ok(existsSync(join(dir, 'beta/scripts/run.mjs')));
});

test('add with no --dir writes under the claude folder of the cwd', () => {
  const cwd = tmp();
  const r = run(['add', 'alpha'], { from: src(), cwd });
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(cwd, '.claude/skills/alpha/SKILL.md')));
});

for (const [agent, folder] of [['codex', '.codex'], ['cursor', '.cursor'], ['pi', '.pi'], ['agents', '.agents']]) {
  test(`--agent ${agent} writes under ${folder}/skills`, () => {
    const cwd = tmp();
    const r = run(['add', 'alpha', '--agent', agent], { from: src(), cwd });
    assert.equal(r.code, 0, r.err);
    assert.ok(existsSync(join(cwd, folder, 'skills/alpha/SKILL.md')));
  });
}

test('--global writes under the home folder', () => {
  const home = tmp();
  const r = run(['add', 'alpha', '--global'], { from: src(), env: { HOME: home, USERPROFILE: home } });
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(home, '.claude/skills/alpha/SKILL.md')));
});

test('a group name expands to its skills', () => {
  const dir = tmp();
  const r = run(['add', 'review', '--dir', dir], { from: src() });
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(dir, 'beta/SKILL.md')));
  assert.ok(existsSync(join(dir, 'gamma/SKILL.md')));
  assert.ok(!existsSync(join(dir, 'alpha')));
});

test('list prints every skill with its group', () => {
  const r = run(['list'], { from: src() });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'alpha\tcore\nbeta\treview\ngamma\treview\n');
});

test('list --json prints exactly the three rows', () => {
  const r = run(['list', '--json'], { from: src() });
  assert.deepEqual(JSON.parse(r.out), [
    { name: 'alpha', group: 'core' },
    { name: 'beta', group: 'review' },
    { name: 'gamma', group: 'review' },
  ]);
});

test('list --json over the real tree lists plan-critic in review', () => {
  const rows = JSON.parse(run(['list', '--json']).out);
  assert.ok(rows.some((r) => r.name === 'plan-critic' && r.group === 'review'));
});

test('an unknown name exits 2 and names the nearest skill', () => {
  const r = run(['add', 'bta', '--dir', tmp()], { from: src() });
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown skill or group "bta"/);
  assert.match(r.err, /did you mean "beta"\?/);
});

test('an unknown name among valid ones writes nothing', () => {
  const dir = tmp();
  const r = run(['add', 'alpha', 'nope', '--dir', dir], { from: src() });
  assert.equal(r.code, 2);
  assert.ok(!existsSync(join(dir, 'alpha')));
});

test('an existing target is refused, keeps its files and writes nothing else', () => {
  const dir = tmp();
  mkdirSync(join(dir, 'beta'));
  writeFileSync(join(dir, 'beta/marker'), 'mine');
  const r = run(['add', 'alpha', 'beta', '--dir', dir], { from: src() });
  assert.equal(r.code, 1);
  assert.match(r.err, /--force/);
  assert.match(r.err, /beta/);
  assert.equal(readFileSync(join(dir, 'beta/marker'), 'utf8'), 'mine');
  assert.ok(!existsSync(join(dir, 'alpha')));
});

test('--force replaces an existing target', () => {
  const dir = tmp();
  mkdirSync(join(dir, 'beta'));
  writeFileSync(join(dir, 'beta/marker'), 'mine');
  const r = run(['add', 'alpha', 'beta', '--dir', dir, '--force'], { from: src() });
  assert.equal(r.code, 0, r.err);
  assert.ok(!existsSync(join(dir, 'beta/marker')));
  assert.ok(existsSync(join(dir, 'beta/SKILL.md')));
  assert.ok(existsSync(join(dir, 'alpha/SKILL.md')));
});

test('bad usage exits 2 with the usage text', () => {
  for (const args of [['add', 'alpha', '--agent', 'vim'], ['add', 'alpha', '--bogus'], ['add', 'alpha', '--dir', 'x', '--global'], []]) {
    const r = run(args, { from: src() });
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, /Usage:/);
  }
});

test('the only command is kaas-blueprint and the package has no dependency', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(pkg.bin), ['kaas-blueprint']);
  assert.ok(!existsSync(join(ROOT, 'bin/blueprint.mjs')));
  assert.ok(readFileSync(BIN, 'utf8').startsWith('#!/usr/bin/env node'));
  accessSync(BIN, constants.X_OK);
  assert.ok(!('dependencies' in pkg));
  assert.ok(!('devDependencies' in pkg));
});
