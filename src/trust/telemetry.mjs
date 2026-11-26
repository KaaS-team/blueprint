// Opt-in install telemetry. Off by default.
// It is on only when BLUEPRINT_TELEMETRY=1 is set or the config file says {"telemetry": true}.
// Events are written to a local file. Nothing is sent over the network by this code.
// An event holds only the fields in FIELDS. Paths, user names, host names and repo names are never added.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const FIELDS = ['event', 'skill', 'agent', 'version', 'day'];
export const EVENTS = ['install', 'recommend'];

export const configPath = (home = homedir()) => join(home, '.config', 'blueprint', 'config.json');
export const logPath = (home = homedir()) => join(home, '.config', 'blueprint', 'telemetry.jsonl');

export function isEnabled({ env = process.env, home = homedir() } = {}) {
  if (env.BLUEPRINT_TELEMETRY === '0') return false;
  if (env.BLUEPRINT_TELEMETRY === '1') return true;
  try {
    return existsSync(configPath(home)) && JSON.parse(readFileSync(configPath(home), 'utf8')).telemetry === true;
  } catch {
    return false;
  }
}

// Keeps only allowed fields and a coarse day, never a time.
export function buildEvent(input, now = new Date()) {
  if (!EVENTS.includes(input.event)) throw new Error(`unknown event "${input.event}"`);
  const out = { day: now.toISOString().slice(0, 10) };
  for (const k of FIELDS) if (k !== 'day' && typeof input[k] === 'string') out[k] = input[k].slice(0, 80);
  return out;
}

// Returns the event that was written, or null when telemetry is off.
export function record(input, opts = {}) {
  const home = opts.home ?? homedir();
  if (!isEnabled({ env: opts.env ?? process.env, home })) return null;
  const event = buildEvent(input, opts.now);
  mkdirSync(dirname(logPath(home)), { recursive: true });
  appendFileSync(logPath(home), `${JSON.stringify(event)}\n`);
  return event;
}
