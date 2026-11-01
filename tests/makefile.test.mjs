import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const make = (...args) => {
  const r = spawnSync('make', ['-n', ...args], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test('make check names every check script except check-mutations', () => {
  const out = make('check');
  const scripts = readdirSync(join(ROOT, 'scripts')).filter((f) => /^check-.*\.mjs$/.test(f) && f !== 'check-mutations.mjs');
  for (const s of scripts) assert.ok(out.includes(`scripts/${s}`), `${s} missing from make check`);
});

test('make test FILES= runs only the named files', () => {
  const out = make('test', 'FILES=tests/scaffold.test.mjs');
  assert.ok(out.includes('node --test tests/scaffold.test.mjs'));
  assert.ok(!out.includes('check-structure'));
});
