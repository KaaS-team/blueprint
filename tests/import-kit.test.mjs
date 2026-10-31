import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const run = (kit, out) =>
  spawnSync(process.execPath, [join(ROOT, 'scripts', 'import-kit.mjs'), join(ROOT, 'tests', 'fixtures', kit), '--out', out], { encoding: 'utf8' });
const tmp = () => mkdtempSync(join(tmpdir(), 'blueprint-import-'));
const read = (out, rel) => readFileSync(join(out, rel), 'utf8');

test('renames, strips and merges the fixture kit', () => {
  const out = tmp();
  const r = run('kit', out);
  assert.equal(r.status, 0, r.stderr);

  const intent = read(out, 'plugins/blueprint-core/skills/intent/SKILL.md');
  assert.match(intent, /^name: intent$/m);
  assert.match(intent, /^description: .*Use when/m);
  assert.doesNotMatch(intent, /kaas/i);
  assert.doesNotMatch(intent, /\/Users\//);

  const ship = read(out, 'plugins/blueprint-ship/skills/ship/SKILL.md');
  assert.match(ship, /## Verify/);
  assert.match(ship, /Start with intent,/);
  assert.match(ship, /Run the checks/);

  assert.doesNotMatch(read(out, 'plugins/blueprint-core/agents/verifier.md'), /^model:/m);
  assert.match(read(out, 'plugins/blueprint-core/rules/comments.md'), /Comments explain why/);
});

test('prints each dropped line to stderr', () => {
  const r = run('kit', tmp());
  assert.match(r.stderr, /dropped plugins\/blueprint-core\/skills\/intent\/SKILL\.md:\d+: This line names kaas internals/);
  assert.match(r.stderr, /dropped plugins\/blueprint-core\/skills\/intent\/SKILL\.md:\d+: See \/Users\//);
  assert.match(r.stderr, /missing agents\/gate-triage\.md/);
});

test('refuses a leak and writes nothing', () => {
  const out = tmp();
  const r = run('kit-leak', out);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /still names the company/);
  assert.deepEqual(readdirSync(out), []);
});
