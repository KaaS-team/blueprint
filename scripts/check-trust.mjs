import { finish, rootFromArgs } from './lib.mjs';
import { readCatalogue, scanEntry } from '../src/trust/catalogue.mjs';

export const MIN_SECURITY = 70;

// Every entry carries a security score that matches a fresh scan, and the score meets the floor.
export function checkTrust(root) {
  const problems = [];
  for (const e of readCatalogue(root)) {
    const label = `catalogue ${e.id}`;
    const fresh = scanEntry(root, e);
    if (!fresh) {
      problems.push(`${label}: nothing on disk to scan`);
      continue;
    }
    if (typeof e.security?.score !== 'number' || !e.security.scanned) problems.push(`${label}: no security score (run node src/trust/cli.mjs scores)`);
    else if (e.security.score !== fresh.score) problems.push(`${label}: security score ${e.security.score} is stale, a fresh scan gives ${fresh.score}`);
    if (fresh.score < MIN_SECURITY) problems.push(`${label}: security score ${fresh.score} is under ${MIN_SECURITY}`);
    if (e.score !== null && (typeof e.score !== 'number' || e.score < 0 || e.score > 1 || !e.scored)) problems.push(`${label}: eval score must be 0 to 1 with a scored date`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) finish('trust', checkTrust(rootFromArgs()));
