#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upstreamPacks } from './check-catalogue.mjs';
import { DEFAULT_ROOT, upstreams } from './lib.mjs';
import { gitSource } from './upgrade-pins.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Regenerates the vendored plugin copies from the catalogue. For each upstream entry it takes the pinned commit from the
// entry's source and the file list from upstreams.json. A copy whose bytes already match the pin is left alone and the
// upstream is not contacted. Any other copy is fetched at the pinned commit, checked against the pinned sha256 and written.
// Entries for this repo's own skills and agents are not copies and are never touched.
// Returns { written, problems }.
export async function buildPlugin({ root = DEFAULT_ROOT, source = gitSource(), log = () => {} } = {}) {
  const catalogue = JSON.parse(readFileSync(join(root, 'catalogue', 'catalogue.json'), 'utf8'));
  const pins = upstreams(root);
  const packs = upstreamPacks(root);
  const written = [];
  const problems = [];
  for (const entry of catalogue) {
    const m = /^([\w.-]+\/[\w.-]+)@([0-9a-f]{40})#(.+)$/.exec(entry.source);
    if (!m) continue;
    const [, repo, sha, path] = m;
    const pack = packs.find((p) => p.repo === repo && p.path === path);
    if (!pack) {
      problems.push(`${entry.id}: source ${entry.source} is not in upstreams.json`);
      continue;
    }
    const files = pins.find((u) => u.repo === repo).files.filter((f) => f.to.startsWith(`${pack.dest}/`));
    for (const f of files) {
      const dest = join(root, f.to);
      if (existsSync(dest) && sha256(readFileSync(dest)) === f.sha256) continue;
      try {
        const bytes = await source.fetchFile(repo, sha, f.from);
        if (sha256(bytes) !== f.sha256) throw new Error(`sha256 ${sha256(bytes)} does not match the pin`);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, bytes);
        written.push(f.to);
        log(`wrote ${f.to}`);
      } catch (e) {
        problems.push(`${f.to}: ${e.message}`);
      }
    }
  }
  return { written, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { written, problems } = await buildPlugin({ source: gitSource(process.env.UPGRADE_PINS_BASE), log: (l) => console.log(l) });
  for (const p of problems) console.log(`FAIL ${p}`);
  console.log(`build-plugin: ${written.length} written, ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}
