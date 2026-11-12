import { finish, listFiles, readText, rootFromArgs } from './lib.mjs';

const AGENT = /^plugins\/[^/]+\/agents\/([^/]+)\.md$/;
const RULE = /^plugins\/[^/]+\/rules\/[^/]+\.md$/;
const root = rootFromArgs();
const problems = [];

// Reads the key: value lines of a frontmatter block, or null when there is none.
function fields(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

for (const file of listFiles(root)) {
  if (AGENT.test(file)) {
    const fm = fields(readText(root, file));
    if (!fm) {
      problems.push(`${file}: no frontmatter block`);
      continue;
    }
    if (fm.name !== AGENT.exec(file)[1]) problems.push(`${file}: name "${fm.name ?? ''}" does not match the file name`);
    if (!(fm.description ?? '').includes('Use when')) problems.push(`${file}: description has no "Use when"`);
    if (!/^---[\s\S]*?---\s*\S/.test(readText(root, file))) problems.push(`${file}: no body`);
  } else if (RULE.test(file)) {
    if (readText(root, file).trim() === '') problems.push(`${file}: empty rule`);
  }
}

finish('agents', problems);
