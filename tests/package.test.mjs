import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

test('package.json is publishable', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.ok(!('private' in pkg), 'private must be dropped');
});

test('the installer prints usage and exits 0 for --help', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'kaas-blueprint.mjs'), '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Usage:/);
});

test('npm pack then npx of the tarball prints usage', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-'));
  const cache = mkdtempSync(join(tmpdir(), 'npm-cache-'));
  const env = { ...process.env, npm_config_cache: cache, npm_config_offline: 'true', npm_config_update_notifier: 'false' };
  const pack = spawnSync('npm', ['pack', '--pack-destination', dir, '--silent'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr);
  const tgz = readdirSync(dir).find((f) => /^kaas-blueprint-.*\.tgz$/.test(f));
  assert.ok(tgz, `no tarball in ${dir}`);
  const r = spawnSync('npx', ['--yes', `./${tgz}`, '--help'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /Usage:/);
  assert.match(r.stdout, /kaas-blueprint add/);
});
