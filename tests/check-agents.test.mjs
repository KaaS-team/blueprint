import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-agents.mjs';
const AGENT = 'plugins/blueprint-core/agents/helper.md';
const agent = (name, description = 'Does a job. Use when a job needs doing.', body = 'Do the job.\n') =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;

test('passes a well-formed agent and rule', () => {
  assertPasses(SCRIPT, fixture({ [AGENT]: agent('helper'), 'plugins/blueprint-core/rules/r.md': '- be kind\n' }));
});

test('fails when the agent name differs from the file name', () => {
  assertFails(SCRIPT, fixture({ [AGENT]: agent('other') }), /does not match/);
});

test('fails when the agent description has no "Use when"', () => {
  assertFails(SCRIPT, fixture({ [AGENT]: agent('helper', 'Does a job.') }), /Use when/);
});

test('fails when the agent has no body', () => {
  assertFails(SCRIPT, fixture({ [AGENT]: agent('helper', undefined, '') }), /no body/);
});

test('fails on an empty rule', () => {
  assertFails(SCRIPT, fixture({ 'plugins/blueprint-core/rules/r.md': '\n' }), /empty rule/);
});

test('loads the three agents and two rules in this repo', () => {
  const files = [
    'plugins/blueprint-core/agents/verifier.md',
    'plugins/blueprint-review/agents/complexity-surgeon.md',
    'plugins/blueprint-ship/agents/gate-triage.md',
    'plugins/blueprint-core/rules/engineering.md',
    'plugins/blueprint-core/rules/comments.md',
  ];
  for (const f of files) assert.ok(readFileSync(join(ROOT, f), 'utf8').trim().length > 0, f);
  assertPasses(SCRIPT, ROOT);
});
