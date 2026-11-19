import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, symlinkSync } from 'node:fs';
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
  // npx would fetch the SDK from the registry, which tests must not reach.
  // Unpack the tarball and run it with the repo's installed dependencies instead.
  const tar = spawnSync('tar', ['-xzf', join(dir, tgz), '-C', dir], { encoding: 'utf8' });
  assert.equal(tar.status, 0, tar.stderr);
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'package', 'node_modules'));
  assert.ok(existsSync(join(dir, 'package', 'src', 'mcp', 'server.mjs')), 'src/mcp must be packed');
  const r = spawnSync(process.execPath, [join(dir, 'package', 'bin', 'kaas-blueprint.mjs'), '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /Usage:/);
  assert.match(r.stdout, /kaas-blueprint add/);
});

test('the packed tarball runs init --team in a fresh repo and creates the team files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-init-'));
  const repo = mkdtempSync(join(tmpdir(), 'init-repo-'));
  const cache = mkdtempSync(join(tmpdir(), 'npm-cache-'));
  const env = { ...process.env, npm_config_cache: cache, npm_config_offline: 'true', npm_config_update_notifier: 'false' };
  const pack = spawnSync('npm', ['pack', '--pack-destination', dir, '--silent'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr);
  const tgz = readdirSync(dir).find((f) => /^kaas-blueprint-.*\.tgz$/.test(f));
  assert.equal(spawnSync('tar', ['-xzf', join(dir, tgz), '-C', dir]).status, 0);
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'package', 'node_modules'));
  const bin = join(dir, 'package', 'bin', 'kaas-blueprint.mjs');
  const r = spawnSync(process.execPath, [bin, 'init', '--team', '--dir', repo], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  for (const f of ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json']) assert.ok(existsSync(join(repo, f)), `${f} missing\n${r.stdout}`);
  assert.match(r.stdout, /create AGENTS\.md/);
  const again = spawnSync(process.execPath, [bin, 'init', '--team', '--dir', repo], { encoding: 'utf8' });
  assert.match(again.stdout, /nothing to change/);
});

test('package.json is at 1.0.0, ships the changelog, and the changelog has a 1.0.0 section', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.0.0');
  assert.ok(pkg.files.includes('CHANGELOG.md'));
  assert.match(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'), /^## 1\.0\.0 /m);
});

test('the routing eval has at least 20 cases and check-routing reports at least 90%', () => {
  let cases = 0;
  for (const f of readdirSync(join(ROOT, 'routing'))) {
    const d = JSON.parse(readFileSync(join(ROOT, 'routing', f), 'utf8'));
    cases += d.positive.length + d.negative.length;
  }
  assert.ok(cases >= 20, `only ${cases} cases`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'check-routing.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const m = /\((\d+(?:\.\d+)?)%\)/.exec(r.stdout);
  assert.ok(m && Number(m[1]) >= 90, r.stdout);
});
