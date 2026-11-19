import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { AGENT_DIRS } from './catalog.mjs';

// Copies a skill folder into the agent's skills folder. Returns the destination.
export function installSkill(skill, { agent, projectDir, global = false, force = false }) {
  if (!(agent in AGENT_DIRS)) throw new Error(`unknown agent "${agent}". Use one of: ${Object.keys(AGENT_DIRS).join(', ')}`);
  const base = global ? homedir() : resolve(projectDir ?? process.cwd());
  const dest = join(base, AGENT_DIRS[agent], skill.id);
  if (existsSync(dest) && !force) throw new Error(`${dest} already exists. Pass force to replace it.`);
  mkdirSync(join(base, AGENT_DIRS[agent]), { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  cpSync(skill.src, dest, { recursive: true });
  return dest;
}
