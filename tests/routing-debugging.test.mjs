import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { rank } from '../scripts/routing-rank.mjs';

function docs() {
  const out = [];
  for (const plugin of readdirSync(join(ROOT, 'plugins'))) {
    const dir = join(ROOT, 'plugins', plugin, 'skills');
    let skills = [];
    try { skills = readdirSync(dir); } catch { continue; }
    for (const s of skills) {
      let t;
      try { t = readFileSync(join(dir, s, 'SKILL.md'), 'utf8'); } catch { continue; }
      const d = /^description:\s*(.*)$/m.exec(t)?.[1] ?? '';
      out.push({ name: s, text: `${s} ${d}` });
    }
  }
  return out;
}

test('real bug, crash and flaky test prompts route to systematic-debugging', () => {
  const all = docs();
  for (const p of [
    'There is a bug where the page crashes on load with unexpected behavior, find the root cause',
    'A flaky test failure keeps showing up, find the cause before proposing fixes',
  ]) assert.equal(rank(all, p)[0], 'systematic-debugging', p);
});

test('every real skill is the top pick for at least one of its own positive prompts', () => {
  const all = docs();
  for (const { name } of all) {
    const j = JSON.parse(readFileSync(join(ROOT, 'routing', `${name}.json`), 'utf8'));
    assert.ok(j.positive.some((p) => rank(all, p)[0] === name), `${name} is never selected`);
  }
});
