import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { finish, listFiles, readText, rootFromArgs, sha256File, upstreams, vendoredFiles } from './lib.mjs';

const root = rootFromArgs();
const problems = [];
const ups = upstreams(root);
const vendored = vendoredFiles(root);
const notice = existsSync(`${root}/NOTICE`) ? readText(root, 'NOTICE') : '';

for (const u of ups) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(u.repo)) problems.push(`${u.repo}: not an owner/name repo`);
  if (!/^[0-9a-f]{40}$/.test(u.sha)) problems.push(`${u.repo}: sha is not 40 lowercase hex`);
  if (u.licence !== 'MIT') problems.push(`${u.repo}: licence is ${u.licence}, expected MIT`);
  const pinned = notice.split(/\r?\n/).some((l) => l.includes(u.repo) && l.includes(u.sha));
  if (!pinned) problems.push(`NOTICE: no line with ${u.repo} and ${u.sha}`);
  for (const f of u.files) {
    if (!existsSync(`${root}/${f.to}`)) {
      problems.push(`${f.to}: missing on disk`);
      continue;
    }
    if (sha256File(root, f.to) !== f.sha256) problems.push(`${f.to}: bytes differ from the pin`);
  }
}

const folders = [...vendored].filter((f) => f.endsWith('/SKILL.md')).map((f) => dirname(f));
const files = listFiles(root);
for (const folder of folders) {
  for (const f of files.filter((x) => x.startsWith(`${folder}/`))) {
    if (!vendored.has(f)) problems.push(`${f}: not listed in upstreams.json`);
  }
  if (!vendored.has(`${folder}/LICENSE`)) problems.push(`${folder}: no LICENSE entry`);
}

finish('vendor', problems);
