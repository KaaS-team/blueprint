import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { decodePng, diffImages, encodePng } from '../plugins/blueprint-design/skills/visual-diff/scripts/pixel-diff.mjs';

const SCRIPT = join(ROOT, 'plugins/blueprint-design/skills/visual-diff/scripts/pixel-diff.mjs');
const image = (w, h, fill, edits = {}) => {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set(edits[i] ?? fill, i * 4);
  return { width: w, height: h, rgba };
};
const WHITE = [255, 255, 255, 255];

test('a PNG survives encode and decode', () => {
  const img = image(3, 2, WHITE, { 4: [1, 2, 3, 255] });
  const back = decodePng(encodePng(img));
  assert.deepEqual([back.width, back.height], [3, 2]);
  assert.ok(back.rgba.equals(img.rgba));
});

test('diffImages counts changed pixels and flags a size change', () => {
  const a = image(10, 10, WHITE);
  const b = image(10, 10, WHITE, { 0: [0, 0, 0, 255], 1: [0, 0, 0, 255] });
  const r = diffImages(a, b);
  assert.equal(r.changed, 2);
  assert.equal(r.percent, 2);
  assert.equal(diffImages(a, image(5, 5, WHITE)).sizeMismatch, true);
  assert.equal(diffImages(a, image(10, 10, [250, 255, 255, 255]), 10).changed, 0);
});

function run(a, b, ...extra) {
  const dir = mkdtempSync(join(tmpdir(), 'blueprint-px-'));
  const files = [a, b].map((img, i) => {
    const p = join(dir, `${i}.png`);
    writeFileSync(p, typeof img === 'string' ? img : encodePng(img));
    return p;
  });
  return spawnSync(process.execPath, [SCRIPT, ...files, ...extra], { encoding: 'utf8' });
}

test('the script prints a gate line and sets the exit code by the threshold', () => {
  const a = image(10, 10, WHITE);
  const b = image(10, 10, WHITE, { 0: [0, 0, 0, 255] });
  const pass = run(a, a);
  assert.equal(pass.status, 0);
  assert.match(pass.stdout, /^FACTORY_GATES: status=PASS passed=1 failed=0 skipped=0 failed_gates=$/m);
  const fail = run(a, b);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /status=FAIL .*failed_gates=visual-diff/);
  assert.equal(run(a, b, '--threshold', '1').status, 0);
  assert.match(run(a, image(4, 4, WHITE)).stdout, /different sizes/);
  assert.match(run('not a png', a).stdout, /status=MISCONFIGURED/);
});
