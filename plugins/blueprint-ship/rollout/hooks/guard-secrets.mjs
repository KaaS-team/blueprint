#!/usr/bin/env node
// PreToolUse hook. Reads the hook payload as JSON on stdin and exits 2 when the tool call
// touches a secret file: .env files, a secrets folder, private keys or cloud credentials.
// Exit 0 lets the call through. This is a filename check, not a sandbox: it does not read file contents.
import { basename } from 'node:path';

const SAFE_ENV = /^\.env\.(example|sample|template|dist)$/i;
const SECRET_NAME = [/^\.env(\..+)?$/i, /\.(pem|key|p12|pfx)$/i, /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i, /^credentials(\.json)?$/i];
const SECRET_DIR = /(^|[\\/])(secrets?|\.aws|\.ssh)[\\/]/i;

export function isSecretPath(p) {
  if (typeof p !== 'string' || p === '') return false;
  const name = basename(p.replace(/[\\/]+$/, ''));
  if (SAFE_ENV.test(name)) return false;
  return SECRET_NAME.some((r) => r.test(name)) || SECRET_DIR.test(`${p}/`);
}

// The strings a tool call can use to name a file.
export function candidates(toolName, input = {}) {
  const out = [input.file_path, input.path, input.notebook_path, input.glob, input.pattern].filter((v) => typeof v === 'string');
  if (toolName === 'Bash' && typeof input.command === 'string') {
    out.push(...input.command.split(/[\s'"`;|&<>=()]+/).filter(Boolean));
  }
  return out;
}

export function decide(payload) {
  const hit = candidates(payload?.tool_name, payload?.tool_input).find(isSecretPath);
  return hit ? { block: true, reason: `blocked: ${hit} looks like a secret file. Ask the user for the value instead of reading it.` } : { block: false };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error('guard-secrets: stdin is not JSON, call blocked');
    process.exit(2);
  }
  const d = decide(payload);
  if (d.block) {
    console.error(d.reason);
    process.exit(2);
  }
}
