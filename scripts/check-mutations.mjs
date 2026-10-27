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
  spawnSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

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
    writeFileSync(path, original.replace(search, replace));
    const r = spawnSync(process.execPath, ['--test', test], { cwd: dir, encoding: 'utf8' });
    if (r.status === 0) {
      problems.push(`${label}: mutation survived, its test passed`);
    } else {
      console.log(`caught: ${label}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

finish('mutations', problems);
