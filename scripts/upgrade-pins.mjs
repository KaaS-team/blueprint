#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROOT } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKS = ['check-vendor.mjs', 'check-evals.mjs', 'check-routing.mjs'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Network defaults. base is a URL prefix such as https://github.com, or a local folder holding <owner>/<name> bare repos.
export function gitSource(base = 'https://github.com') {
  const local = !/^[a-z]+:\/\//.test(base);
  const url = (repo) => (local ? join(base, repo) : `${base}/${repo}.git`);
  return {
    async resolveHead(repo) {
      const r = spawnSync('git', ['ls-remote', url(repo), 'HEAD'], { encoding: 'utf8' });
      const sha = /^([0-9a-f]{40})\s+HEAD/m.exec(r.stdout ?? '')?.[1];
      if (r.status !== 0 || !sha) throw new Error(`git ls-remote failed for ${repo}: ${(r.stderr || 'no HEAD').trim()}`);
      return sha;
    },
    async fetchFile(repo, sha, path) {
      if (local) {
        const r = spawnSync('git', ['-C', url(repo), 'show', `${sha}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
        if (r.status !== 0) throw new Error(`${path} is not in ${repo} at ${sha}`);
        return r.stdout;
      }
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/${sha}/${path}`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${path} in ${repo} at ${sha}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// Runs the three offline checks against root. Returns { ok, output }.
export function offlineChecks(root) {
  let output = '';
  for (const c of CHECKS) {
    const r = spawnSync(process.execPath, [join(HERE, c), root], { encoding: 'utf8' });
    output += `${r.stdout}${r.stderr}`;
    if (r.status !== 0) return { ok: false, output };
  }
  return { ok: true, output };
}

function setNoticeSha(notice, repo, from, to) {
  return notice
    .split('\n')
    .map((l) => (l.includes(repo) && l.includes(from) ? l.replaceAll(from, to) : l))
    .join('\n');
}

// Returns one result per upstream: { repo, status: 'current' | 'would-bump' | 'bumped' | 'held', reason?, from, to }.
export async function upgradePins({ root = DEFAULT_ROOT, source = gitSource(), runChecks = offlineChecks, dryRun = false, only, log = () => {} } = {}) {
  const results = [];
  const pinsPath = join(root, 'upstreams.json');
  const noticePath = join(root, 'NOTICE');
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8'));

  for (const u of pins.filter((p) => !only || p.repo === only)) {
    const res = { repo: u.repo, from: u.sha };
    results.push(res);
    try {
      const head = await source.resolveHead(u.repo);
      res.to = head;
      if (head === u.sha) {
        res.status = 'current';
        log(`current ${u.repo} at ${head}`);
        continue;
      }
      const fetched = [];
      for (const f of u.files) fetched.push({ f, bytes: await source.fetchFile(u.repo, head, f.from) });
      const changed = fetched.filter(({ f, bytes }) => sha256(bytes) !== f.sha256);
      if (changed.length === 0) {
        res.status = 'current';
        res.reason = 'files are identical at the new HEAD, pin left alone';
        log(`current ${u.repo}: ${res.reason}`);
        continue;
      }
      if (dryRun) {
        res.status = 'would-bump';
        log(`would bump ${u.repo} ${u.sha} -> ${head}: ${changed.map(({ f }) => f.to).join(', ')}`);
        continue;
      }

      // Apply in place, run the checks, and restore the old bytes if they fail.
      const before = new Map(u.files.map((f) => [f.to, existsSync(join(root, f.to)) ? readFileSync(join(root, f.to)) : null]));
      const oldPins = readFileSync(pinsPath, 'utf8');
      const oldNotice = existsSync(noticePath) ? readFileSync(noticePath, 'utf8') : null;
      const restore = () => {
        for (const [to, bytes] of before) {
          if (bytes === null) rmSync(join(root, to), { force: true });
          else writeFileSync(join(root, to), bytes);
        }
        writeFileSync(pinsPath, oldPins);
        if (oldNotice !== null) writeFileSync(noticePath, oldNotice);
      };
      for (const { f, bytes } of fetched) {
        mkdirSync(dirname(join(root, f.to)), { recursive: true });
        writeFileSync(join(root, f.to), bytes);
        f.sha256 = sha256(bytes);
      }
      const next = JSON.parse(oldPins);
      const entry = next.find((p) => p.repo === u.repo);
      entry.sha = head;
      for (const f of entry.files) f.sha256 = fetched.find((x) => x.f.to === f.to).f.sha256;
      writeFileSync(pinsPath, `${JSON.stringify(next, null, 2)}\n`);
      if (oldNotice !== null) writeFileSync(noticePath, setNoticeSha(oldNotice, u.repo, u.sha, head));

      const check = runChecks(root);
      if (check.ok) {
        res.status = 'bumped';
        log(`bumped ${u.repo} ${u.sha} -> ${head}`);
      } else {
        restore();
        res.status = 'held';
        res.reason = check.output.split('\n').filter((l) => /^FAIL|problem/.test(l)).join('; ') || check.output.trim();
        log(`held ${u.repo} at ${u.sha}: ${res.reason}`);
      }
    } catch (e) {
      res.status = 'held';
      res.reason = e.message;
      log(`held ${u.repo} at ${u.sha}: ${e.message}`);
    }
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const only = args.find((a) => /^[\w.-]+\/[\w.-]+$/.test(a));
  const results = await upgradePins({ dryRun, only, source: gitSource(process.env.UPGRADE_PINS_BASE), log: (l) => console.log(l) });
  process.exit(results.some((r) => r.status === 'held') ? 1 : 0);
}
