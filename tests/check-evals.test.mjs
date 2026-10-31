import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertFails, assertPasses, fixture, ROOT } from './helpers.mjs';

const SCRIPT = 'check-evals.mjs';
const SKILL = 'plugins/blueprint-core/skills/demo/SKILL.md';
const CASE = 'plugins/blueprint-core/evals/demo--basic';

const PROMPT = '---\nmax_turns: 10\nallowed_tools: [Read, Glob]\n---\nDo the demo thing.\n';
const TRIGGER = '---\ntype: tool_used\ntool: Skill\ninput_match: demo\n---\nThe skill fired.\n';
const OUTCOME = '---\ntype: regex\ntarget: last_message\nmatch: contains\npattern: demo\nflags: i\n---\nIt said demo.\n';

function files(overrides = {}) {
  const base = {
    [SKILL]: '---\nname: demo\ndescription: Use when demoing.\n---\n',
    [`${CASE}/prompt.md`]: PROMPT,
    [`${CASE}/graders/trigger.md`]: TRIGGER,
    [`${CASE}/graders/outcome.md`]: OUTCOME,
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) delete base[k];
    else base[k] = v;
  }
  return base;
}

test('a covered skill passes', () => assertPasses(SCRIPT, fixture(files())));

test('a skill with no case fails', () => {
  const dir = fixture({ [SKILL]: files()[SKILL] });
  assertFails(SCRIPT, dir, /demo: no eval case/);
});

test('a case naming an unknown skill fails', () => {
  const dir = fixture(files({ 'plugins/blueprint-core/evals/ghost--basic/prompt.md': PROMPT }));
  assertFails(SCRIPT, dir, /ghost--basic: names no skill/);
});

test('a case with no Skill grader fails', () => {
  const dir = fixture(files({ [`${CASE}/graders/trigger.md`]: null }));
  assertFails(SCRIPT, dir, /no tool_used Skill grader/);
});

test('a case with no regex grader fails', () => {
  const dir = fixture(files({ [`${CASE}/graders/outcome.md`]: null }));
  assertFails(SCRIPT, dir, /no regex grader/);
});

test('a case with no prompt.md fails', () => {
  const dir = fixture(files({ [`${CASE}/prompt.md`]: null }));
  assertFails(SCRIPT, dir, /no prompt\.md/);
});

function runWithBase(dir) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', SCRIPT), dir], {
    encoding: 'utf8',
    env: { ...process.env, EVAL_BASE: 'HEAD' },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function committed() {
  const dir = fixture(files());
  spawnSync('git', ['add', '-A'], { cwd: dir });
  const c = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(c.status, 0, c.stderr);
  return dir;
}

test('a changed SKILL.md with no case change fails', () => {
  const dir = committed();
  writeFileSync(join(dir, SKILL), '---\nname: demo\ndescription: Use when demoing more.\n---\n');
  const r = runWithBase(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no eval change/);
});

test('a changed SKILL.md with a case change passes', () => {
  const dir = committed();
  writeFileSync(join(dir, SKILL), '---\nname: demo\ndescription: Use when demoing more.\n---\n');
  writeFileSync(join(dir, `${CASE}/prompt.md`), PROMPT.replace('thing', 'other thing'));
  const r = runWithBase(dir);
  assert.equal(r.code, 0, r.out);
});
