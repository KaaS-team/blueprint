import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const BIN = join(ROOT, 'bin', 'kaas-blueprint.mjs');
const repo = () => mkdtempSync(join(tmpdir(), 'team-'));
const run = (dir, ...args) => {
  const r = spawnSync(process.execPath, [BIN, 'init', '--team', '--dir', dir, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const file = (d, p) => readFileSync(join(d, p), 'utf8');

const TABLE = [
  { agent: 'claude', files: ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/blueprint-ship/hooks/guard-secrets.mjs'], absent: ['.cursor', '.gemini'] },
  { agent: 'cursor', files: ['AGENTS.md', '.cursor/rules/kaas-blueprint.mdc'], absent: ['CLAUDE.md', '.gemini'] },
  { agent: 'codex', files: ['AGENTS.md'], absent: ['CLAUDE.md', '.cursor', '.gemini'] },
  { agent: 'gemini', files: ['AGENTS.md', '.gemini/settings.json'], absent: ['CLAUDE.md', '.cursor'] },
];

for (const { agent, files, absent } of TABLE) {
  test(`target ${agent} writes its files and a second run changes nothing`, () => {
    const d = repo();
    const r = run(d, '--agents', agent);
    assert.equal(r.code, 0, r.err);
    for (const f of files) assert.ok(existsSync(join(d, f)), f);
    for (const f of absent) assert.ok(!existsSync(join(d, f)), f);
    const before = files.map((f) => file(d, f));
    const again = run(d, '--agents', agent);
    assert.match(again.out, /nothing to change/);
    assert.deepEqual(files.map((f) => file(d, f)), before);
  });
}

test('an existing CLAUDE.md is kept and gains one pointer line', () => {
  const d = repo();
  writeFileSync(join(d, 'CLAUDE.md'), '# My project\n\nUse tabs.\n');
  run(d);
  const text = file(d, 'CLAUDE.md');
  assert.ok(text.startsWith('# My project\n\nUse tabs.\n'));
  assert.equal(text.split('@AGENTS.md').length - 1, 1);
  run(d);
  assert.equal(file(d, 'CLAUDE.md'), text);
});

test('an existing AGENTS.md and settings are merged, not overwritten', () => {
  const d = repo();
  mkdirSync(join(d, '.claude'));
  writeFileSync(join(d, 'AGENTS.md'), '# Mine\n\nKeep this.\n');
  writeFileSync(join(d, '.claude/settings.json'), JSON.stringify({ model: 'x', permissions: { allow: ['Bash(ls)'], deny: ['Read(./.env)'] } }));
  run(d);
  assert.match(file(d, 'AGENTS.md'), /^# Mine\n\nKeep this\./);
  assert.match(file(d, 'AGENTS.md'), /Secrets/);
  const s = JSON.parse(file(d, '.claude/settings.json'));
  assert.equal(s.model, 'x');
  assert.ok(s.permissions.allow.includes('Bash(ls)') && s.permissions.allow.includes('Bash(make check)'));
  assert.equal(s.permissions.deny.filter((x) => x === 'Read(./.env)').length, 1);
  assert.equal(s.hooks.PreToolUse.length, 1);
  assert.equal(s.hooks.Stop.length, 1);
});

test('--dry-run prints the files and writes nothing', () => {
  const d = repo();
  const r = run(d, '--dry-run');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /would create AGENTS\.md/);
  assert.match(r.out, /would create \.claude\/settings\.json/);
  assert.ok(!existsSync(join(d, 'AGENTS.md')));
});

test('broken settings JSON refuses and writes nothing', () => {
  const d = repo();
  mkdirSync(join(d, '.claude'));
  writeFileSync(join(d, '.claude/settings.json'), '{oops');
  const r = run(d);
  assert.equal(r.code, 1);
  assert.ok(!existsSync(join(d, 'AGENTS.md')));
});

test('unknown agent and missing --team are usage errors', () => {
  assert.equal(run(repo(), '--agents', 'vim').code, 2);
  const r = spawnSync(process.execPath, [BIN, 'init'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});
