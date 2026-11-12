import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { rank } from '../scripts/routing-rank.mjs';
import { frontmatter } from '../scripts/check-structure.mjs';

const SKILL_DIR = join(ROOT, 'plugins', 'blueprint-review', 'skills', 'first-run');
const text = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');

test('first-run walks every step in order', () => {
  const order = ['auditor audit --gh', 'Top 3 risks', 'Pick one', 'plan-critic', 'test-first', 'fresh subagent', 'verification-before-completion', 'code-review-and-quality', 'gate', 'draft PR', 'auditor reaudit'];
  let at = -1;
  for (const needle of order) {
    const i = text.indexOf(needle, at + 1);
    assert.ok(i > at, `${needle} missing or out of order`);
    at = i;
  }
});

test('first-run description starts with Use when', () => {
  assert.ok(frontmatter(text).description.startsWith('Use when'));
});

test('at least three first-run prompts route to first-run at rank 1', () => {
  const docs = [];
  for (const g of ['blueprint-core', 'blueprint-review']) {
    for (const n of ['first-run', 'plan-critic', 'code-review-and-quality', 'verification-before-completion', 'grilling', 'systematic-debugging', 'domain-modeling', 'codebase-design', 'improve-codebase-architecture']) {
      const p = join(ROOT, 'plugins', g, 'skills', n, 'SKILL.md');
      if (existsSync(p)) docs.push({ name: n, text: `${n} ${frontmatter(readFileSync(p, 'utf8')).description ?? ''}` });
    }
  }
  const { positive } = JSON.parse(readFileSync(join(ROOT, 'routing', 'first-run.json'), 'utf8'));
  assert.ok(positive.length >= 3);
  assert.ok(positive.filter((q) => rank(docs, q)[0] === 'first-run').length >= 3);
});

test('the fixture repo has a failing-to-fix finding and an audit sample', () => {
  assert.ok(existsSync(join(SKILL_DIR, 'fixtures', 'repo', 'src', 'retry.mjs')));
  assert.match(readFileSync(join(SKILL_DIR, 'fixtures', 'audit.txt'), 'utf8'), /retry\(\)/);
});

test('the first-run eval has a trigger grader and an outcome grader', () => {
  const dir = join(ROOT, 'plugins', 'blueprint-review', 'evals', 'first-run--audit');
  assert.match(readFileSync(join(dir, 'graders', 'trigger.md'), 'utf8'), /input_match: first-run/);
  assert.match(readFileSync(join(dir, 'graders', 'outcome.md'), 'utf8'), /type: regex/);
});
