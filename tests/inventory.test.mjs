import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { BANNED, COMMAND, DOMAIN, upstreams, vendoredFiles } from '../scripts/lib.mjs';

const vendored = [...vendoredFiles(ROOT)].filter((f) => f.endsWith('/SKILL.md')).map((f) => f.replace(/\/SKILL\.md$/, ''));

test('seven upstream skills are pinned, each with a LICENSE and a 40 character commit', () => {
  assert.equal(vendored.length, 7);
  for (const u of upstreams(ROOT)) assert.match(u.sha, /^[0-9a-f]{40}$/);
  for (const d of vendored) assert.ok(existsSync(join(ROOT, d, 'LICENSE')), `${d} has no LICENSE`);
});

// The eight kit sources land in seven skills: verify is merged into ship. The list is read from the
// importer's own map, so a skill the importer writes cannot be missing here.
const kitSkills = () => [...new Set([...readFileSync(join(ROOT, 'scripts', 'import-kit.mjs'), 'utf8').matchAll(/'(plugins\/[^/']+\/skills\/[^/']+)\/SKILL\.md'/g)].map((m) => m[1]))];
const kitSources = () => [...readFileSync(join(ROOT, 'scripts', 'import-kit.mjs'), 'utf8').matchAll(/\['(skills\/[^/']+)\/SKILL\.md'/g)].map((m) => m[1]);

test('eight kit skills load and none names the company or a client', () => {
  assert.equal(kitSources().length, 8);
  const kit = kitSkills();
  assert.deepEqual(kit.map((d) => d.split('/').at(-1)).sort(), ['add-dependency', 'debug-e2e', 'impact-map', 'intent', 'repo-audit', 'ship', 'structural-test']);
  for (const d of kit) {
    assert.ok(existsSync(join(ROOT, d, 'SKILL.md')), `${d} is not imported`);
    assert.ok(!vendored.includes(d), `${d} is vendored, not a kit skill`);
    const text = readFileSync(join(ROOT, d, 'SKILL.md'), 'utf8');
    assert.match(text, new RegExp(`^---\\nname: ${d.split('/').at(-1)}\\n`), `${d} has no frontmatter`);
    assert.ok(!BANNED.test(text.replace(DOMAIN, '').replace(COMMAND, '')), `${d} names the company or a client`);
  }
});
