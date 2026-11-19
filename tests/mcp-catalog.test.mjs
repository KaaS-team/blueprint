// Pins the behaviour of src/mcp/catalog.mjs and src/mcp/install.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AGENT_DIRS, loadCatalogue, searchSkills } from '../src/mcp/catalog.mjs';
import { installSkill } from '../src/mcp/install.mjs';

const root = resolve(import.meta.dirname, '..');
const skills = [
  { id: 'verify', group: 'a', tags: ['testing'], description: 'Run the tests before you ship' },
  { id: 'ship-it', group: 'b', tags: ['release'], description: 'Ship a release' },
  { id: 'alpha', group: 'b', tags: ['testing', 'release'], description: 'Nothing here' },
];

test('searchSkills scores id and tag words 3, description words 1, and sorts by score then id', () => {
  const table = [
    [{ query: 'verify' }, ['verify']],
    [{ query: 'ship' }, ['ship-it', 'verify']],
    [{ query: 'testing' }, ['alpha', 'verify']],
    [{ query: 'zzz' }, []],
    [{}, ['alpha', 'ship-it', 'verify']],
    [{ tags: ['testing', 'release'] }, ['alpha']],
    [{ tags: ['Release'], query: 'ship' }, ['ship-it']],
  ];
  for (const [input, ids] of table) assert.deepEqual(searchSkills(skills, input).map((r) => r.id), ids, JSON.stringify(input));
  assert.deepEqual(searchSkills(skills, { query: 'verify' })[0], { id: 'verify', group: 'a', tags: ['testing'], description: skills[0].description, score: 3 });
});

test('loadCatalogue joins entries to skill folders with a description and a group', () => {
  const loaded = loadCatalogue(root);
  assert.ok(loaded.length > 0);
  for (const s of loaded) {
    assert.equal(typeof s.src, 'string');
    assert.equal(typeof s.group, 'string');
    assert.equal(typeof s.description, 'string');
    assert.ok(!s.group.startsWith('blueprint-'));
  }
});

test('installSkill rejects an unknown agent and refuses to overwrite without force', () => {
  const skill = loadCatalogue(root)[0];
  const projectDir = mkdtempSync(join(tmpdir(), 'bp-install-'));
  assert.throws(() => installSkill(skill, { agent: 'nope', projectDir }), /unknown agent "nope"/);
  const dest = installSkill(skill, { agent: 'claude', projectDir });
  assert.equal(dest, join(projectDir, AGENT_DIRS.claude, skill.id));
  assert.throws(() => installSkill(skill, { agent: 'claude', projectDir }), /already exists/);
  assert.equal(installSkill(skill, { agent: 'claude', projectDir, force: true }), dest);
});
