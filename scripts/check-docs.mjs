import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { finish, readText, rootFromArgs } from './lib.mjs';

// Checks the README's fenced sh and bash blocks: every Make target and every
// script path (node, bash, sh or ./path) that a command line names must exist.
// Broken relative links in any markdown file are reported by check-links.
const root = rootFromArgs();
const problems = [];

const targets = new Set();
if (existsSync(join(root, 'Makefile'))) {
  for (const line of readText(root, 'Makefile').split('\n')) {
    const m = /^([A-Za-z0-9_.-]+(?:\s+[A-Za-z0-9_.-]+)*)\s*:(?!=)/.exec(line);
    if (m) m[1].split(/\s+/).forEach((t) => targets.add(t));
    const p = /^\.PHONY:\s*(.*)$/.exec(line);
    if (p) p[1].split(/\s+/).filter(Boolean).forEach((t) => targets.add(t));
  }
}

const readme = existsSync(join(root, 'README.md')) ? readText(root, 'README.md') : '';
const FENCE = /^```(\w*)\s*\n([\s\S]*?)^```/gm;
for (const [, lang, body] of readme.matchAll(FENCE)) {
  if (lang !== 'sh' && lang !== 'bash') continue;
  for (const raw of body.split('\n')) {
    const line = raw.replace(/^\s*\$\s*/, '').replace(/\s+#.*$/, '').trim();
    const words = line.split(/\s+/);
    // Skip leading VAR=value words.
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
    if (!words.length) continue;
    const [cmd, ...args] = words;
    if (cmd === 'make') {
      for (const a of args.filter((w) => !w.startsWith('-') && !w.includes('='))) {
        if (!targets.has(a)) problems.push(`README.md: "${line}" names Make target ${a}, which does not exist`);
      }
    } else {
      const script = cmd === 'node' || cmd === 'bash' || cmd === 'sh' ? args.find((w) => !w.startsWith('-')) : cmd.startsWith('./') ? cmd : null;
      if (script && !existsSync(join(root, script))) problems.push(`README.md: "${line}" names ${script}, which does not exist`);
    }
  }
}

finish('docs', problems);
