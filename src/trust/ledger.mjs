// Evidence ledger: one JSON line per claim, with merge and prune.
// The idea comes from the autoharness project (MIT). No code is copied from it.
// A record is { id, claim, source, seen, count, status } where seen is YYYY-MM-DD.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const STATUSES = ['open', 'confirmed', 'refuted'];

export function parseLedger(text) {
  return text.split('\n').filter(Boolean).map((l, i) => {
    try {
      return JSON.parse(l);
    } catch {
      throw new Error(`ledger line ${i + 1} is not valid JSON`);
    }
  });
}

export const readLedger = (file) => (existsSync(file) ? parseLedger(readFileSync(file, 'utf8')) : []);
export const writeLedger = (file, records) => writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''));

// Merges records with the same id: counts add up, the latest day wins, and a refuted or confirmed status beats open.
export function merge(...lists) {
  const byId = new Map();
  for (const r of lists.flat()) {
    if (!r.id || !STATUSES.includes(r.status ?? 'open')) throw new Error(`bad ledger record ${JSON.stringify(r)}`);
    const cur = byId.get(r.id);
    if (!cur) {
      byId.set(r.id, { count: 1, status: 'open', ...r });
      continue;
    }
    cur.count += r.count ?? 1;
    if (r.seen > cur.seen) Object.assign(cur, { seen: r.seen, claim: r.claim ?? cur.claim, source: r.source ?? cur.source });
    if (r.status && r.status !== 'open') cur.status = r.status;
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// Drops refuted records and open records not seen since cutoff (YYYY-MM-DD). Confirmed records stay.
export function prune(records, { cutoff }) {
  return records.filter((r) => r.status !== 'refuted' && (r.status === 'confirmed' || r.seen >= cutoff));
}
