import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { finish, readText, rootFromArgs } from './lib.mjs';

const root = rootFromArgs();
const mutations = JSON.parse(readFileSync(join(root, 'tests', 'mutations.json'), 'utf8'));
const problems = [];

// Copies the repo into a fresh temp dir and makes it a git repo, so the checks list files the same way.
function copyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'blueprint-mutation-'));
  cpSync(root, dir, { recursive: true, filter: (src) => basename(src) !== '.git' });
  const init = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8' });
  if (init.status !== 0) throw new Error(`git init failed in ${dir}: ${init.stderr}`);
  return dir;
}

// Run from inside `node --test`, a child would inherit NODE_TEST_CONTEXT and skip running its tests.
const { NODE_TEST_CONTEXT, ...env } = process.env;
const runTest = (dir, test) => spawnSync(process.execPath, ['--test', test], { cwd: dir, env, encoding: 'utf8' });

for (const { file, search, replace, test } of mutations) {
  const label = `${file} (${test})`;
  const dir = copyRepo();
  try {
    const path = join(dir, file);
    const original = readFileSync(path, 'utf8');
    const occurrences = original.split(search).length - 1;
    if (occurrences !== 1) {
      problems.push(`${label}: search occurs ${occurrences} times, expected exactly 1`);
      continue;
    }
    // A test that fails on the unmutated copy would make every mutation look caught.
    const baseline = runTest(dir, test);
    if (baseline.status !== 0 || baseline.error) {
      problems.push(`${label}: test does not pass on the unmutated copy`);
      continue;
    }
    writeFileSync(path, original.replace(search, replace));
    const r = runTest(dir, test);
    if (r.status === 0) {
      problems.push(`${label}: mutation survived, its test passed`);
    } else if (r.status !== 1 || r.error) {
      problems.push(`${label}: test run crashed instead of failing (status ${r.status})`);
    } else {
      console.log(`caught: ${label}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

finish('mutations', problems);
