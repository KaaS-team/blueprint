import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { recommend, detectStack } from '../scripts/recommend.mjs';

const catalogue = JSON.parse(readFileSync(join(ROOT, 'catalogue/catalogue.json'), 'utf8'));
const DESIGN = ['design-system-map', 'read-design', 'visual-check'];
const fixture = (n) => join(ROOT, 'tests/fixtures/repos', n);
const top = (n, limit = 5) => recommend(fixture(n), catalogue, { limit });

for (const name of ['hono', 'go-service', 'fastapi']) {
  test(`${name}: no design skill in the top 5`, () => {
    const ids = top(name).map((r) => r.id);
    for (const d of DESIGN) assert.ok(!ids.includes(d), `${d} recommended for ${name}`);
    assert.ok(detectStack(fixture(name)).traits.has('backend'));
  });
}

test('react-app: at least one design skill, with evidence', () => {
  const rows = top('react-app');
  const hit = rows.filter((r) => DESIGN.includes(r.id));
  assert.ok(hit.length >= 1);
  assert.ok(hit[0].evidence.some((e) => /react/.test(e)));
});

test('every recommendation carries evidence', () => {
  for (const n of ['hono', 'go-service', 'fastapi', 'react-app']) {
    for (const r of top(n)) assert.ok(r.evidence.length > 0, `${n}/${r.id}`);
  }
});

test('hono ci skill is backed by the workflow file', () => {
  const r = top('hono', 16).find((x) => x.id === 'gate-triage');
  assert.ok(r.evidence.includes('.github/workflows'));
});
