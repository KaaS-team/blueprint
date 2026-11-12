import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { finish, listFiles, rootFromArgs, sha256File, upstreams } from './lib.mjs';

export const KINDS = ['skill', 'agent', 'workflow', 'check'];
export const LICENCES = ['MIT', 'Apache-2.0'];
const SOURCE = /^([\w.-]+(?:\/[\w.-]+)?)@([0-9a-f]{40}|HEAD)#(.+)$/;

// One pack per vendored SKILL.md: where it lives here, where it comes from, and the pinned hash of its SKILL.md.
export function upstreamPacks(root) {
  const packs = [];
  for (const u of upstreams(root)) {
    for (const f of u.files.filter((x) => x.to.endsWith('/SKILL.md'))) {
      packs.push({ repo: u.repo, sha: u.sha, licence: u.licence, path: dirname(f.from), dest: dirname(f.to), sha256: f.sha256 });
    }
  }
  return packs;
}

export function checkCatalogue(root) {
  const problems = [];
  const path = join(root, 'catalogue', 'catalogue.json');
  if (!existsSync(path)) return ['catalogue/catalogue.json: missing'];
  let entries;
  try {
    entries = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return [`catalogue/catalogue.json: not valid JSON (${e.message})`];
  }
  if (!Array.isArray(entries)) return ['catalogue/catalogue.json: not an array'];

  const ids = new Set();
  const matched = new Set();
  const packs = upstreamPacks(root);
  const covered = new Set(); // repo paths of own entries and destinations of upstream entries
  for (const e of entries) {
    const label = `catalogue ${e?.id ?? '(no id)'}`;
    if (typeof e?.id !== 'string' || !e.id) problems.push(`${label}: id is missing`);
    else if (ids.has(e.id)) problems.push(`${label}: duplicate id`);
    else ids.add(e.id);
    if (!KINDS.includes(e.kind)) problems.push(`${label}: kind "${e.kind}" is not one of ${KINDS.join(', ')}`);
    if (!LICENCES.includes(e.licence)) problems.push(`${label}: licence "${e.licence}" is not MIT or Apache-2.0`);
    if (!/^[0-9a-f]{64}$/.test(e.sha256 ?? '')) problems.push(`${label}: sha256 is not 64 lowercase hex`);
    if (!Array.isArray(e.tags) || e.tags.length === 0 || e.tags.some((t) => typeof t !== 'string' || !t)) problems.push(`${label}: tags must be a non-empty list of strings`);
    if (e.eval !== null && (typeof e.eval !== 'string' || !existsSync(join(root, e.eval)))) problems.push(`${label}: eval "${e.eval}" is not null or an existing file`);

    const m = SOURCE.exec(e.source ?? '');
    if (!m) {
      problems.push(`${label}: source is not repo@sha#path`);
      continue;
    }
    const [, repo, sha, srcPath] = m;
    if (sha === 'HEAD') {
      // An own entry: the path is in this repo and the hash is of that file (a skill's SKILL.md).
      covered.add(srcPath);
      const file = srcPath.endsWith('.md') ? srcPath : `${srcPath}/SKILL.md`;
      if (!existsSync(join(root, file))) problems.push(`${label}: ${file} is missing on disk`);
      else if (sha256File(root, file) !== e.sha256) problems.push(`${label}: sha256 differs from ${file}`);
      continue;
    }
    const pack = packs.find((p) => p.repo === repo && p.path === srcPath);
    if (!pack) {
      problems.push(`${label}: source ${e.source} is not in upstreams.json`);
      continue;
    }
    matched.add(pack);
    covered.add(pack.dest);
    if (pack.sha !== sha) problems.push(`${label}: source sha ${sha} differs from the pin ${pack.sha}`);
    if (pack.licence !== e.licence) problems.push(`${label}: licence ${e.licence} differs from the pin ${pack.licence}`);
    if (pack.sha256 !== e.sha256) problems.push(`${label}: sha256 differs from the pinned SKILL.md`);
  }

  for (const p of packs) if (!matched.has(p)) problems.push(`upstreams.json: ${p.repo}#${p.path} has no catalogue entry`);

  // Every skill and agent shipped in a plugin folder is in the catalogue.
  for (const f of listFiles(root)) {
    const skill = /^(plugins\/[^/]+\/skills\/[^/]+)\/SKILL\.md$/.exec(f);
    const agent = /^plugins\/[^/]+\/agents\/[^/]+\.md$/.exec(f);
    const key = skill ? skill[1] : agent ? f : null;
    if (key && !covered.has(key)) problems.push(`${key}: not in the catalogue`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  finish('catalogue', checkCatalogue(rootFromArgs()));
}
