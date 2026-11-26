// Writes scan and eval results into catalogue/catalogue.json.
// Each entry gets "security": { score, findings, scanned } from a fresh scan,
// and "score" plus "scored" (the date) from an eval report when one is given.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { upstreamPacks } from '../../scripts/check-catalogue.mjs';
import { scanPath } from './scan.mjs';
import { scoresFromReport } from './evalscore.mjs';

const path = (root) => join(root, 'catalogue', 'catalogue.json');

export function readCatalogue(root) {
  return JSON.parse(readFileSync(path(root), 'utf8'));
}

// The repo path an entry points at: a skill folder, or one file for an agent.
// Vendored upstream entries map through upstreams.json to where they live here.
export function entryPath(root, entry) {
  const m = /^([^@]+)@[^#]+#(.+)$/.exec(entry.source);
  if (!m) return null;
  if (m[1] === 'blueprint') return m[2];
  return upstreamPacks(root).find((p) => p.repo === m[1] && p.path === m[2])?.dest ?? null;
}

// The scan of one entry. Returns null when the path is not on disk.
export function scanEntry(root, entry) {
  const rel = entryPath(root, entry);
  if (!rel || !existsSync(join(root, rel))) return null;
  const { score, findings } = scanPath(join(root, rel));
  return { score, findings: findings.length };
}

// Merges every eval report in dir (a folder of <group>.json files) into one Map.
export function loadReports(dir) {
  const all = new Map();
  if (!existsSync(dir)) return all;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    for (const [k, v] of scoresFromReport(JSON.parse(readFileSync(join(dir, f), 'utf8')))) all.set(k, v);
  }
  return all;
}

// Returns the updated entries. date is YYYY-MM-DD. Without reports, "score" stays as it is.
export function updateCatalogue(root, { date, reports = new Map() }) {
  return readCatalogue(root).map((e) => {
    const next = { ...e };
    const scan = scanEntry(root, e);
    if (scan) next.security = { ...scan, scanned: date };
    const r = reports.get(e.id);
    if (r) {
      next.score = r.score;
      next.scored = date;
    }
    return next;
  });
}

export function writeCatalogue(root, entries) {
  writeFileSync(path(root), `${JSON.stringify(entries, null, 2)}\n`);
}
