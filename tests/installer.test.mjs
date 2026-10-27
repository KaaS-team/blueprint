import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT } from './helpers.mjs';

// Fixture skills per group. Two in core, so the group test proves every member is copied.
const SKILLS = {
  'blueprint-core': ['alpha', 'delta'],
  'blueprint-review': ['beta'],
  'blueprint-ship': ['gamma'],
};
const AGENT_DIRS = { claude: '.claude/skills', codex: '.codex/skills', cursor: '.cursor/skills', pi: '.pi/skills', agents: '.agents/skills' };

const dirs = [];
function tmp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// Writes one fixture skill folder with a SKILL.md under plugins/<group>/skills/<name>/.
function skill(src, group, name) {
  const folder = join(src, 'plugins', group, 'skills', name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'SKILL.md'), `---\nname: ${name}\ndescription: Fixture ${name}. Use when testing.\n---\n\n# ${name}\n`);
}

// A temp source repo holding a copy of the CLI and the fixture skills.
function source() {
  const src = tmp('blueprint-src-');
  mkdirSync(join(src, 'bin'), { recursive: true });
  copyFileSync(join(ROOT, 'bin', 'blueprint.mjs'), join(src, 'bin', 'blueprint.mjs'));
  for (const [group, names] of Object.entries(SKILLS)) for (const name of names) skill(src, group, name);
  return src;
}

function cli(src, args, { cwd, env = {} } = {}) {
  const r = spawnSync(process.execPath, [join(src, 'bin', 'blueprint.mjs'), ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const sourceText = (src, group, name) => readFileSync(join(src, 'plugins', group, 'skills', name, 'SKILL.md'), 'utf8');

test('add copies a skill into .claude/skills in the working directory by default', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  const r = cli(src, ['add', 'alpha'], { cwd: project });
  assert.equal(r.code, 0, r.err);
  const copied = join(project, '.claude', 'skills', 'alpha', 'SKILL.md');
  assert.equal(readFileSync(copied, 'utf8'), sourceText(src, 'blueprint-core', 'alpha'));
});

test('add honours --agent for every agent skills directory', () => {
  for (const [agent, rel] of Object.entries(AGENT_DIRS)) {
    const src = source();
    const project = tmp('blueprint-project-');
    const r = cli(src, ['add', 'alpha', '--agent', agent], { cwd: project });
    assert.equal(r.code, 0, `${agent}: ${r.err}`);
    assert.ok(existsSync(join(project, rel, 'alpha', 'SKILL.md')), `${agent}: nothing copied to ${rel}`);
  }
});

test('add --global installs under HOME instead of the working directory', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  const home = tmp('blueprint-home-');
  const r = cli(src, ['add', 'alpha', '--global'], { cwd: project, env: { HOME: home } });
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(home, '.claude', 'skills', 'alpha', 'SKILL.md')));
  assert.equal(existsSync(join(project, '.claude')), false);
});

test('add --dir installs into exactly the given path', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  const dest = join(tmp('blueprint-dest-'), 'custom', 'skills');
  const r = cli(src, ['add', 'alpha', '--dir', dest], { cwd: project });
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(dest, 'alpha', 'SKILL.md')));
  assert.equal(existsSync(join(project, '.claude')), false);
});

test('list prints each skill on its own line with its group', () => {
  const src = source();
  const r = cli(src, ['list']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^alpha\s+core$/m);
  assert.match(r.out, /^delta\s+core$/m);
  assert.match(r.out, /^beta\s+review$/m);
  assert.match(r.out, /^gamma\s+ship$/m);
});

test('list --json prints a parseable array of { name, group } for every skill', () => {
  const src = source();
  const r = cli(src, ['list', '--json']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out), [
    { name: 'alpha', group: 'core' },
    { name: 'delta', group: 'core' },
    { name: 'beta', group: 'review' },
    { name: 'gamma', group: 'ship' },
  ]);
});

test('add expands a group name to every skill in that group', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  const r = cli(src, ['add', 'core'], { cwd: project });
  assert.equal(r.code, 0, r.err);
  assert.ok(existsSync(join(project, '.claude', 'skills', 'alpha', 'SKILL.md')));
  assert.ok(existsSync(join(project, '.claude', 'skills', 'delta', 'SKILL.md')));
  assert.equal(existsSync(join(project, '.claude', 'skills', 'beta')), false);
});

test('add exits 2 on an unknown name, suggests the nearest name and copies nothing', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  const r = cli(src, ['add', 'alpx', 'alpha'], { cwd: project });
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.err, /"alpha"/);
  assert.equal(existsSync(join(project, '.claude')), false);

  const typo = cli(src, ['add', 'reviw'], { cwd: project });
  assert.equal(typo.code, 2, typo.out + typo.err);
  assert.match(typo.err, /"review"/);
});

test('add exits 2 with a message on an unknown agent, including prototype keys', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  for (const agent of ['nope', 'constructor', 'toString', '__proto__']) {
    const r = cli(src, ['add', 'alpha', '--agent', agent], { cwd: project });
    assert.equal(r.code, 2, `${agent}: ${r.out}${r.err}`);
    assert.match(r.err, /unknown agent/);
    assert.doesNotMatch(r.err, /TypeError/);
  }
  assert.equal(existsSync(join(project, '.claude')), false);
});

test('add rejects a flag or empty string given as the value of --dir', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  for (const args of [['--dir', '--force'], ['--dir', '']]) {
    const r = cli(src, ['add', 'alpha', ...args], { cwd: project });
    assert.equal(r.code, 2, r.out + r.err);
    assert.match(r.err, /needs a value/);
  }
});

test('add refuses an existing target without --force and replaces it with --force', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  const existing = join(project, '.claude', 'skills', 'alpha');
  mkdirSync(existing, { recursive: true });
  writeFileSync(join(existing, 'SKILL.md'), 'local edit\n');

  const refused = cli(src, ['add', 'alpha'], { cwd: project });
  assert.notEqual(refused.code, 0);
  assert.notEqual(refused.code, 2);
  assert.match(refused.err, /alpha/);
  assert.equal(readFileSync(join(existing, 'SKILL.md'), 'utf8'), 'local edit\n');

  const forced = cli(src, ['add', 'alpha', '--force'], { cwd: project });
  assert.equal(forced.code, 0, forced.err);
  assert.equal(readFileSync(join(existing, 'SKILL.md'), 'utf8'), sourceText(src, 'blueprint-core', 'alpha'));
});

test('add --force never deletes the source skill when --dir points into the source repo', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  const skills = join(src, 'plugins', 'blueprint-core', 'skills');
  for (const dir of [skills, join(skills, 'alpha')]) {
    const r = cli(src, ['add', 'alpha', '--force', '--dir', dir], { cwd: project });
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /source skill/);
    assert.ok(existsSync(join(skills, 'alpha', 'SKILL.md')), `source lost with --dir ${dir}`);
  }
});

test('add --force leaves no staging folder behind', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  cli(src, ['add', 'alpha'], { cwd: project });
  const r = cli(src, ['add', 'alpha', '--force'], { cwd: project });
  assert.equal(r.code, 0, r.err);
  assert.equal(existsSync(join(project, '.claude', 'skills', 'alpha.blueprint-tmp')), false);
});

test('add refuses the whole call when any target exists, copying none of it', () => {
  const src = source();
  const project = tmp('blueprint-project-');
  mkdirSync(join(project, '.claude', 'skills', 'alpha'), { recursive: true });

  const r = cli(src, ['add', 'alpha', 'beta'], { cwd: project });
  assert.notEqual(r.code, 0);
  assert.equal(existsSync(join(project, '.claude', 'skills', 'beta')), false);
});
