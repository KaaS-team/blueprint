import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');

// Writes { relativePath: content } into a new git repo in a temp dir and returns its path.
export function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'blueprint-fixture-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, body] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return dir;
}

function run(script, root) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), root], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

// A failing check exits 1 and prints a FAIL line. Requiring both stops a crash
// (which also exits 1) from counting as a correct rejection.
export function assertFails(script, root, pattern) {
  const r = run(script, root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL/);
  if (pattern) assert.match(r.out, pattern);
}

export function assertPasses(script, root) {
  const r = run(script, root);
  assert.equal(r.code, 0, r.out);
}
