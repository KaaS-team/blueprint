import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const GROUPS = ['blueprint-core', 'blueprint-review', 'blueprint-ship'];
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

test('marketplace lists the three plugin groups, each sourced from its folder', () => {
  const m = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.deepEqual(m.plugins.map((p) => p.name), GROUPS);
  for (const p of m.plugins) assert.equal(p.source, `./plugins/${p.name}`);
});

test('each plugin manifest is named after its folder and points at kaas.team', () => {
  for (const g of GROUPS) {
    const p = JSON.parse(read(`plugins/${g}/.claude-plugin/plugin.json`));
    assert.equal(p.name, g);
    assert.equal(p.homepage, 'https://kaas.team');
  }
});

test('each group keeps skills, agents, rules and evals with a .gitkeep, and has no hooks folder', () => {
  for (const g of GROUPS) {
    for (const d of ['skills', 'agents', 'rules', 'evals']) {
      assert.ok(existsSync(join(ROOT, 'plugins', g, d, '.gitkeep')), `${g}/${d}/.gitkeep is missing`);
    }
    assert.equal(existsSync(join(ROOT, 'plugins', g, 'hooks')), false, `${g} must not have hooks/`);
  }
});

test('NOTICE credits the three upstream projects under MIT and excludes trailofbits', () => {
  const n = read('NOTICE');
  for (const upstream of ['addyosmani/agent-skills', 'mattpocock/skills', 'obra/superpowers']) {
    assert.ok(n.includes(upstream), `NOTICE does not credit ${upstream}`);
  }
  assert.match(n, /MIT/);
  assert.match(n, /trailofbits/);
  assert.match(n, /not included/i);
  assert.match(n, /licen[cs]e/i);
});

test('README has the how-to section and the booking line', () => {
  const r = read('README.md');
  assert.match(r, /^## How to add a skill$/m);
  assert.ok(r.includes('Book a call at kaas.team'));
});

test('README has no prices and no "Built by KaaS" line', () => {
  const r = read('README.md');
  assert.doesNotMatch(r, /[$£€]\s?\d/);
  assert.doesNotMatch(r, /\bprices?\b|\bpricing\b/i);
  assert.doesNotMatch(r, /built by kaas/i);
});
