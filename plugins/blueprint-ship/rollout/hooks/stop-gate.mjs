#!/usr/bin/env node
// Stop hook. Runs the repo gate (`make check`, or the command in BLUEPRINT_GATE_CMD) when the agent
// stops. A failing gate exits 2 with the tail of its output, which sends the agent back to work.
// It exits 0 when the gate passes, when the folder has no Makefile or no `check` target, and when
// this stop was already caused by an earlier gate failure (stop_hook_active), so it cannot loop.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;
let payload = {};
try {
  payload = JSON.parse(raw);
} catch {
  // An unreadable payload still runs the gate in the current folder.
}
if (payload.stop_hook_active) process.exit(0);

const cwd = payload.cwd || process.cwd();
const custom = process.env.BLUEPRINT_GATE_CMD;
if (!custom) {
  const makefile = join(cwd, 'Makefile');
  if (!existsSync(makefile) || !/^check:/m.test(readFileSync(makefile, 'utf8'))) process.exit(0);
}
const r = spawnSync(custom || 'make check', { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (r.status === 0) process.exit(0);
const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').slice(-40).join('\n');
console.error(`The gate failed (exit ${r.status}). Fix it before stopping.\n${tail}`);
process.exit(2);
