import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { finish, readText, rootFromArgs, scannedFiles, vendoredFiles } from './lib.mjs';

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const root = rootFromArgs();
const problems = [];
const vendored = vendoredFiles(root);

for (const file of scannedFiles(root).filter((f) => f.endsWith('.md') && !vendored.has(f))) {
  for (const [, link] of readText(root, file).matchAll(LINK)) {
    // Remote links are not fetched, so the check needs no network.
    if (SCHEME.test(link) || link.startsWith('#')) continue;
    const target = link.split('#')[0].split('?')[0];
    if (!existsSync(join(root, dirname(file), target))) problems.push(`${file}: link to ${link} does not exist`);
  }
}

finish('links', problems);
