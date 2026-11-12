import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertFails, assertPasses, fixture, ROOT } from './helpers.mjs';

const SCRIPT = 'check-catalogue.mjs';
const SHA = 'c'.repeat(40);
const sum = (s) => createHash('sha256').update(s).digest('hex');
const SKILL_MD = '---\nname: demo\ndescription: Use when demoing\n---\n';
const OWN_MD = '---\nname: mine\ndescription: Use when mining\n---\n';
const dir = 'plugins/blueprint-core/skills/demo';

const upstream = { repo: 'o/r', sha: SHA, licence: 'MIT', files: [{ from: 'skills/demo/SKILL.md', to: `${dir}/SKILL.md`, sha256: sum(SKILL_MD) }] };
const demo = { id: 'demo', kind: 'skill', source: `o/r@${SHA}#skills/demo`, licence: 'MIT', sha256: sum(SKILL_MD), tags: ['x'], eval: null, score: null };
const mine = { id: 'mine', kind: 'skill', source: `blueprint@${SHA}#plugins/blueprint-core/skills/mine`, licence: 'Apache-2.0', sha256: sum(OWN_MD), tags: ['x'], eval: null, score: null };

function repo({ entries = [demo, mine], pins = [upstream], extra = {} } = {}) {
  return fixture({
    'upstreams.json': JSON.stringify(pins),
    'catalogue/catalogue.json': JSON.stringify(entries),
    [`${dir}/SKILL.md`]: SKILL_MD,
    'plugins/blueprint-core/skills/mine/SKILL.md': OWN_MD,
    ...extra,
  });
}

test('passes a clean fixture', () => assertPasses(SCRIPT, repo()));
test('passes the real repo', () => assertPasses(SCRIPT, ROOT));
test('fails when the catalogue file is missing', () => assertFails(SCRIPT, fixture({ 'upstreams.json': '[]' }), /missing/));
test('fails when an upstream pack has no catalogue entry', () => assertFails(SCRIPT, repo({ entries: [mine] }), /has no catalogue entry/));
test('fails when a catalogue entry names no upstream pack', () => {
  assertFails(SCRIPT, repo({ entries: [demo, mine, { ...demo, id: 'ghost', source: `o/r@${SHA}#skills/ghost` }] }), /not in upstreams\.json/);
});
test('fails when the source sha differs from the pin', () => {
  assertFails(SCRIPT, repo({ entries: [{ ...demo, source: `o/r@${'d'.repeat(40)}#skills/demo` }, mine] }), /differs from the pin/);
});
test('fails when the sha256 differs from the pinned SKILL.md', () => {
  assertFails(SCRIPT, repo({ entries: [{ ...demo, sha256: sum('other') }, mine] }), /sha256 differs/);
});
test('fails when an own skill is not catalogued', () => assertFails(SCRIPT, repo({ entries: [demo] }), /mine: not in the catalogue|skills\/mine: not in the catalogue/));
test('fails when an own entry hash no longer matches its file', () => {
  assertFails(SCRIPT, repo({ entries: [demo, { ...mine, sha256: sum('stale') }] }), /sha256 differs from/);
});
test('fails when an entry is not MIT or Apache-2.0', () => {
  for (const licence of ['GPL-3.0', 'CC-BY-4.0', 'mit', undefined]) {
    assertFails(SCRIPT, repo({ entries: [demo, { ...mine, licence }] }), /is not MIT or Apache-2\.0/);
  }
});
test('fails on a duplicate id, a bad kind, empty tags and a missing eval file', () => {
  assertFails(SCRIPT, repo({ entries: [demo, mine, { ...mine }] }), /duplicate id/);
  assertFails(SCRIPT, repo({ entries: [demo, { ...mine, kind: 'rule' }] }), /kind "rule"/);
  assertFails(SCRIPT, repo({ entries: [demo, { ...mine, tags: [] }] }), /tags/);
  assertFails(SCRIPT, repo({ entries: [demo, { ...mine, eval: 'plugins/none/prompt.md' }] }), /eval/);
});
test('an agent must be catalogued too', () => {
  const extra = { 'plugins/blueprint-core/agents/helper.md': '---\nname: helper\n---\n' };
  assertFails(SCRIPT, repo({ extra }), /agents\/helper\.md: not in the catalogue/);
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const withSource = (source) => repo({ entries: [demo, { ...mine, source }] });

test('fails when an own entry uses @HEAD', () => {
  assertFails(SCRIPT, withSource('blueprint@HEAD#plugins/blueprint-core/skills/mine'), /not a release tag or a full commit sha/);
});
test('passes an own entry pinned to a full sha or a release tag', () => {
  assertPasses(SCRIPT, withSource(`blueprint@${SHA}#plugins/blueprint-core/skills/mine`));
  assertPasses(SCRIPT, withSource('blueprint@v0.2.0#plugins/blueprint-core/skills/mine'));
});
test('fails when an entry has no score field', () => {
  const { score, ...bare } = { ...mine, score: null };
  assertFails(SCRIPT, repo({ entries: [demo, bare] }), /score is missing/);
});
test('every real catalogue entry has a score field', () => {
  const entries = JSON.parse(readFileSync(join(ROOT, 'catalogue', 'catalogue.json'), 'utf8'));
  for (const e of entries) assert.ok('score' in e, `${e.id} has no score`);
});
