import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { listFiles } from '../scripts/lib.mjs';
import { frontmatter } from '../scripts/check-structure.mjs';

const SKILL = /^plugins\/[^/]+\/skills\/([^/]+)\/SKILL\.md$/;
const isPlanRubric = (name, fm) => /rubric/i.test(name) || (/\bplans?\b/i.test(fm.description ?? '') && /rubric/i.test(fm.description ?? ''));

test('plan-critic says it is the rubric the factory points to', () => {
  const text = readFileSync(join(ROOT, 'plugins/blueprint-review/skills/plan-critic/SKILL.md'), 'utf8');
  assert.match(text, /factory-plan-rubric/);
  assert.match(text, /the one plan rubric/i);
});

test('no second plan rubric skill exists', () => {
  const found = listFiles(ROOT)
    .filter((f) => SKILL.test(f))
    .map((f) => ({ name: SKILL.exec(f)[1], fm: frontmatter(readFileSync(join(ROOT, f), 'utf8')) ?? {} }))
    .filter(({ name, fm }) => name !== 'plan-critic' && isPlanRubric(name, fm))
    .map((x) => x.name);
  assert.deepEqual(found, []);
});

test('the detector would flag a second plan rubric skill', () => {
  assert.ok(isPlanRubric('plan-rubric', {}));
  assert.ok(isPlanRubric('x', { description: 'Use when a plan needs a rubric score' }));
  assert.ok(!isPlanRubric('first-run', { description: 'Use when new to a repo' }));
});
