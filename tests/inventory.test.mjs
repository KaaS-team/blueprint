import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { BANNED, COMMAND, DOMAIN, upstreams, vendoredFiles } from '../scripts/lib.mjs';

const skillDirs = () =>
  readdirSync(join(ROOT, 'plugins'))
    .flatMap((p) => (existsSync(join(ROOT, 'plugins', p, 'skills')) ? readdirSync(join(ROOT, 'plugins', p, 'skills')).map((s) => `plugins/${p}/skills/${s}`) : []));

const vendored = [...vendoredFiles(ROOT)].filter((f) => f.endsWith('/SKILL.md')).map((f) => f.replace(/\/SKILL\.md$/, ''));

test('seven upstream skills are pinned, each with a LICENSE and a 40 character commit', () => {
  assert.equal(vendored.length, 7);
  for (const u of upstreams(ROOT)) assert.match(u.sha, /^[0-9a-f]{40}$/);
  for (const d of vendored) assert.ok(existsSync(join(ROOT, d, 'LICENSE')), `${d} has no LICENSE`);
});

test('eight kit skills load and none names the company', () => {
  const kit = skillDirs().filter((d) => existsSync(join(ROOT, d, 'SKILL.md'))).filter((d) => !vendored.includes(d) && !d.startsWith('plugins/blueprint-ship/'));
  assert.equal(kit.length, 8);
  for (const d of kit) {
    const text = readFileSync(join(ROOT, d, 'SKILL.md'), 'utf8');
    assert.match(text, /^---\nname: /, `${d} has no frontmatter`);
    assert.ok(!BANNED.test(text.replace(DOMAIN, '').replace(COMMAND, '')), `${d} names the company`);
  }
});
