import { finish, listFiles, readText, rootFromArgs, scannedFiles } from './lib.mjs';

const SKILL = /^plugins\/[^/]+\/skills\/([^/]+)\/SKILL\.md$/;
const BANNED = /\b(?:kaas|lwp|learnwithparam)\b/i;
const DOMAIN = /\bkaas\.team\b/gi;
// The installer's command name is allowed, like the domain.
const COMMAND = /\bkaas-blueprint\b/gi;

// Reads the key: value pairs of a SKILL.md frontmatter block. Indented lines continue the previous value.
export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fields = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      const value = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
      fields[key] = /^[>|][+-]?$/.test(value) ? '' : value;
    } else if (key && /^\s+\S/.test(line)) {
      fields[key] = `${fields[key]} ${line.trim()}`.trim();
    }
  }
  return fields;
}

const root = rootFromArgs();
const problems = [];

for (const file of listFiles(root).filter((f) => SKILL.test(f))) {
  const folder = SKILL.exec(file)[1];
  const fm = frontmatter(readText(root, file));
  if (!fm) {
    problems.push(`${file}: no frontmatter block`);
    continue;
  }
  if (fm.name !== folder) problems.push(`${file}: name "${fm.name ?? ''}" does not match folder "${folder}"`);
  const description = fm.description ?? '';
  if (!description.includes('Use when')) problems.push(`${file}: description has no "Use when"`);
  if (description.length > 1024) problems.push(`${file}: description is ${description.length} characters, over 1024`);
}

for (const file of scannedFiles(root)) {
  const text = readText(root, file).replace(DOMAIN, '').replace(COMMAND, '');
  if (BANNED.test(text)) problems.push(`${file}: mentions KaaS, LWP or learnwithparam`);
}

finish('structure', problems);
