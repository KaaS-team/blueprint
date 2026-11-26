// Static security scan of one skill folder. No model calls, no network.
// Rules look for secrets, risky shell commands, network calls and prompt-injection phrases.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// weight is the number of points taken off the 100 point score for one finding.
export const RULES = [
  { id: 'secret-aws-key', category: 'secret', weight: 40, pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'secret-private-key', category: 'secret', weight: 40, pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { id: 'secret-token', category: 'secret', weight: 40, pattern: /\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9]{20,}|\bxox[abp]-[A-Za-z0-9-]{10,}/ },
  { id: 'secret-assignment', category: 'secret', weight: 25, pattern: /\b(?:api[_-]?key|secret|password|token)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i },
  { id: 'shell-pipe-to-shell', category: 'shell', weight: 30, pattern: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/ },
  { id: 'shell-rm-rf-root', category: 'shell', weight: 30, pattern: /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(?:\/|~|\$HOME)(?:\s|$)/ },
  { id: 'shell-sudo', category: 'shell', weight: 10, pattern: /\bsudo\s+\S/ },
  { id: 'shell-eval', category: 'shell', weight: 10, pattern: /\beval\s*[(\s"$]/ },
  { id: 'shell-chmod-777', category: 'shell', weight: 8, pattern: /\bchmod\s+(?:-R\s+)?777\b/ },
  { id: 'network-fetch', category: 'network', weight: 5, pattern: /\b(?:curl|wget)\s+(?:-\S+\s+)*https?:\/\//i },
  { id: 'network-code', category: 'network', weight: 5, pattern: /\bfetch\(\s*["'`]https?:\/\/|\bhttps?\.(?:get|request)\(|\brequire\(["']node:?https?["']\)|from ["']node:https?["']/ },
  { id: 'injection-ignore', category: 'injection', weight: 30, pattern: /\bignore (?:all |any )?(?:the )?(?:previous|prior|above|earlier) (?:instructions|rules|prompts?)\b/i },
  { id: 'injection-hide', category: 'injection', weight: 30, pattern: /\bdo not (?:tell|inform|reveal (?:this )?to) the user\b|\bwithout (?:telling|informing) the user\b/i },
  { id: 'injection-override', category: 'injection', weight: 25, pattern: /\b(?:disregard|forget) (?:your|all|the) (?:system prompt|instructions|rules)\b/i },
  { id: 'injection-exfil', category: 'injection', weight: 30, pattern: /\b(?:send|post|upload) (?:the )?(?:contents? of )?(?:\.env|ssh keys?|credentials|secrets?)\b/i },
];

const SKIP = new Set(['node_modules', '.git']);
const TEXT = /\.(?:md|mjs|js|cjs|ts|json|sh|ya?ml|txt|toml)$/i;

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

// Scans text and returns findings: { rule, category, weight, file, line }.
export function scanText(text, file = '(text)') {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const r of RULES) {
      if (r.pattern.test(line)) findings.push({ rule: r.id, category: r.category, weight: r.weight, file, line: i + 1 });
    }
  });
  return findings;
}

// One finding per rule and file counts once, so a long list of one URL does not zero the score.
export function scoreOf(findings) {
  const seen = new Set();
  let lost = 0;
  for (const f of findings) {
    const key = `${f.rule}|${f.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lost += f.weight;
  }
  return Math.max(0, 100 - lost);
}

// Scans every text file under a skill folder. Paths in findings are relative to the folder.
export function scanSkill(dir) {
  const findings = [];
  for (const p of files(dir)) findings.push(...scanText(readFileSync(p, 'utf8'), relative(dir, p)));
  return { score: scoreOf(findings), findings };
}

// Scans a skill folder, or one file such as an agent.
export function scanPath(path) {
  if (statSync(path).isDirectory()) return scanSkill(path);
  const findings = scanText(readFileSync(path, 'utf8'), relative(join(path, '..'), path));
  return { score: scoreOf(findings), findings };
}
