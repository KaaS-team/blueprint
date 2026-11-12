import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const PACK = join(ROOT, 'plugins/blueprint-ship');
const GUARD = join(PACK, 'rollout/hooks/guard-secrets.mjs');
const STOP = join(PACK, 'rollout/hooks/stop-gate.mjs');

function hook(script, payload, { env = {}, raw } = {}) {
  const r = spawnSync(process.execPath, [script], {
    input: raw ?? JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { code: r.status, err: r.stderr };
}

const call = (tool_name, tool_input) => ({ tool_name, tool_input });

test('guard-secrets blocks reads of .env files and secrets', () => {
  for (const p of [call('Read', { file_path: '/repo/.env' }), call('Read', { file_path: '.env.production' }), call('Edit', { file_path: 'app/.env.local' }), call('Read', { file_path: 'secrets/db.txt' }), call('Read', { file_path: 'certs/server.pem' }), call('Grep', { pattern: 'x', path: '.env' }), call('Bash', { command: 'cat .env' }), call('Bash', { command: 'head -n 3 "config/.env.staging"' })]) {
    const r = hook(GUARD, p);
    assert.equal(r.code, 2, JSON.stringify(p));
    assert.match(r.err, /secret file/);
  }
});

test('guard-secrets lets ordinary calls and env templates through', () => {
  for (const p of [call('Read', { file_path: 'src/index.mjs' }), call('Read', { file_path: '.env.example' }), call('Bash', { command: 'make check' }), call('Bash', { command: 'ls environment' }), call('Read', { file_path: 'docs/secrets-policy.md' })]) {
    assert.equal(hook(GUARD, p).code, 0, JSON.stringify(p));
  }
});

test('guard-secrets blocks when stdin is not JSON', () => {
  assert.equal(hook(GUARD, null, { raw: 'not json' }).code, 2);
});

// A fake `make` on PATH stands in for the repo gate. No real gate runs.
function stopRun(makeExit, payloadExtra = {}) {
  const bin = mkdtempSync(join(tmpdir(), 'fake-bin-'));
  writeFileSync(join(bin, 'make'), `#!/bin/sh\necho "fake gate output"\nexit ${makeExit}\n`);
  chmodSync(join(bin, 'make'), 0o755);
  const repo = mkdtempSync(join(tmpdir(), 'fake-repo-'));
  writeFileSync(join(repo, 'Makefile'), 'check:\n\ttrue\n');
  return hook(STOP, { cwd: repo, ...payloadExtra }, { env: { PATH: `${bin}:${process.env.PATH}` } });
}

test('stop-gate exits 0 when the gate passes', () => {
  assert.equal(stopRun(0).code, 0);
});

test('stop-gate exits 2 with the gate output when the gate fails', () => {
  const r = stopRun(1);
  assert.equal(r.code, 2);
  assert.match(r.err, /fake gate output/);
});

test('stop-gate does not loop when the stop was caused by an earlier gate failure', () => {
  assert.equal(stopRun(1, { stop_hook_active: true }).code, 0);
});

test('stop-gate skips a folder with no check target', () => {
  const repo = mkdtempSync(join(tmpdir(), 'no-gate-'));
  assert.equal(hook(STOP, { cwd: repo }).code, 0);
});

test('managed settings carry no provider key and point at hooks that exist', () => {
  const text = readFileSync(join(PACK, 'rollout/managed-settings.json'), 'utf8');
  assert.doesNotMatch(text, /ANTHROPIC|API_KEY|_TOKEN|sk-/);
  const s = JSON.parse(text);
  assert.ok(s.permissions.allow.length > 0);
  assert.ok(s.permissions.deny.includes('Read(./.env)'));
  const commands = [...s.hooks.PreToolUse, ...s.hooks.Stop].flatMap((g) => g.hooks.map((h) => h.command));
  assert.equal(commands.length, 2);
  for (const c of commands) {
    const file = c.replace(/^node \/etc\/claude-code\/blueprint-ship\//, 'rollout/');
    assert.ok(existsSync(join(PACK, file)), `${c} has no file in the pack`);
  }
});

test('every rule file says what it prevents', () => {
  for (const f of ['secrets', 'gate-before-done', 'small-changes']) {
    assert.match(readFileSync(join(PACK, 'rules', `${f}.md`), 'utf8'), /^Prevents: .+\.$/m, f);
  }
});
