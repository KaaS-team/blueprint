#!/usr/bin/env node
// Maintainer tool for the trust data. Not a kaas-blueprint command.
//   node src/trust/cli.mjs scores [--reports <dir>] [--date YYYY-MM-DD]   rewrite catalogue scores
//   node src/trust/cli.mjs allowlist [--min-security N] [--marketplace owner/name]...
//   node src/trust/cli.mjs ledger merge <out> <in>... | ledger prune <file> <cutoff>
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedSkills, managedAllowlist } from './allowlist.mjs';
import { loadReports, readCatalogue, updateCatalogue, writeCatalogue } from './catalogue.mjs';
import { merge, prune, readLedger, writeLedger } from './ledger.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [cmd, ...args] = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

if (cmd === 'scores') {
  const reports = opt('--reports') ? loadReports(resolve(opt('--reports'))) : new Map();
  writeCatalogue(ROOT, updateCatalogue(ROOT, { date: opt('--date') ?? new Date().toISOString().slice(0, 10), reports }));
} else if (cmd === 'allowlist') {
  const entries = readCatalogue(ROOT);
  const marketplaces = args.flatMap((a, i) => (a === '--marketplace' ? [{ source: 'github', repo: args[i + 1] }] : []));
  const minSecurity = Number(opt('--min-security') ?? 80);
  console.log(JSON.stringify(managedAllowlist(entries, { marketplaces, minSecurity }), null, 2));
  console.error(`${allowedSkills(entries, { minSecurity }).length} skills allowed`);
} else if (cmd === 'ledger' && args[0] === 'merge') {
  writeLedger(args[1], merge(...args.slice(2).map(readLedger)));
} else if (cmd === 'ledger' && args[0] === 'prune') {
  writeLedger(args[1], prune(readLedger(args[1]), { cutoff: args[2] }));
} else {
  console.error('usage: scores | allowlist | ledger merge|prune (see the header of this file)');
  process.exit(2);
}
