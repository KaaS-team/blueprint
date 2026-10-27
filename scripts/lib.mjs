import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Factory-owned trees, the licence and the credits file are not scanned by the identity or prose checks.
// The check's own scripts and tests spell the banned words out, so they are not scanned either.
const EXCLUDED_PREFIXES = ['.factory/', '.claude/', '.agents/', '.github/', 'scripts/', 'tests/'];
const EXCLUDED_FILES = ['NOTICE', 'LICENSE'];

export function rootFromArgs() {
  return resolve(process.argv[2] ?? DEFAULT_ROOT);
}

// Every file git knows about in root: tracked, or untracked and not ignored. Paths are relative to root.
export function listFiles(root) {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ls-files failed in ${root}: ${r.stderr}`);
  return r.stdout.split('\n').filter((f) => f && existsSync(join(root, f))).sort();
}

export function isScanned(rel) {
  return !EXCLUDED_FILES.includes(rel) && !EXCLUDED_PREFIXES.some((p) => rel.startsWith(p));
}

export function scannedFiles(root) {
  return listFiles(root).filter(isScanned);
}

// The prose check scans the same files as the identity check, plus NOTICE.
export function proseFiles(root) {
  return listFiles(root).filter((f) => f === 'NOTICE' || isScanned(f));
}

export function readText(root, rel) {
  return readFileSync(join(root, rel), 'utf8');
}

// Prints each problem as a FAIL line and sets the exit code, or prints ok.
export function finish(name, problems) {
  for (const p of problems) console.log(`FAIL ${p}`);
  if (problems.length) {
    console.log(`${name}: ${problems.length} problem(s)`);
    process.exitCode = 1;
  } else {
    console.log(`${name}: ok`);
  }
}
