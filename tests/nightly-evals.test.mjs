import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'blueprint-nightly-'));
  cpSync(join(ROOT, 'plugins'), join(dir, 'plugins'), { recursive: true });
  mkdirSync(join(dir, 'scripts'));
  cpSync(join(ROOT, 'scripts', 'nightly-evals.sh'), join(dir, 'scripts', 'nightly-evals.sh'));
  mkdirSync(join(dir, 'bin'));
  const log = join(dir, 'claude.log');
  writeFileSync(join(dir, 'bin', 'claude'), `#!/bin/sh\necho "$@" >> "${log}"\nexit 0\n`);
  chmodSync(join(dir, 'bin', 'claude'), 0o755);
  return { dir, log };
}

function run(dir, extra = {}) {
  const { CI, ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ...env } = process.env;
  return spawnSync('bash', [join(dir, 'scripts', 'nightly-evals.sh')], {
    encoding: 'utf8',
    env: { ...env, PATH: `${join(dir, 'bin')}:${env.PATH}`, REPORT_ROOT: join(dir, 'out'), ...extra },
  });
}

test('runs each group that has cases with the threshold', () => {
  const { dir, log } = setup();
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines.some((l) => l.includes('plugins/blueprint-core')));
  assert.ok(lines.some((l) => l.includes('plugins/blueprint-review')));
  assert.ok(!lines.some((l) => l.includes('blueprint-ship')));
  for (const l of lines) {
    assert.match(l, /--threshold 0\.67/);
    assert.match(l, /--no-publish/);
  }
});

test('refuses to run in CI', () => {
  const { dir, log } = setup();
  const r = run(dir, { CI: '1' });
  assert.equal(r.status, 2, r.stderr);
  assert.ok(!existsSync(log) || readFileSync(log, 'utf8') === '');
});
