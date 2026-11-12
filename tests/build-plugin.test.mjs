import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT, fixture } from './helpers.mjs';
import { buildPlugin } from '../scripts/build-plugin.mjs';
import { gitSource } from '../scripts/upgrade-pins.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

const LICENSE = 'MIT licence text\n';
const SKILL = '---\nname: tidy\ndescription: Use when you tidy notes\n---\nBody\n';
const dir = 'plugins/g/skills/tidy';

// A local bare upstream at <base>/acme/skills holding one commit, and a blueprint fixture that vendors it.
function setup() {
  const base = mkdtempSync(join(tmpdir(), 'upstream-'));
  const bare = join(base, 'acme', 'skills');
  const work = mkdtempSync(join(tmpdir(), 'upstream-work-'));
  mkdirSync(bare, { recursive: true });
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(work, 'init', '-q', '-b', 'main');
  mkdirSync(join(work, 'skills/tidy'), { recursive: true });
  writeFileSync(join(work, 'LICENSE'), LICENSE);
  writeFileSync(join(work, 'skills/tidy/SKILL.md'), SKILL);
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'c');
  git(work, 'push', '-q', bare, 'main');
  const head = git(work, 'rev-parse', 'HEAD');
  const root = fixture({
    'upstreams.json': JSON.stringify([
      {
        repo: 'acme/skills', sha: head, licence: 'MIT',
        files: [
          { from: 'LICENSE', to: `${dir}/LICENSE`, sha256: sha(LICENSE) },
          { from: 'skills/tidy/SKILL.md', to: `${dir}/SKILL.md`, sha256: sha(SKILL) },
        ],
      },
    ]),
    'catalogue/catalogue.json': JSON.stringify([
      { id: 'tidy', kind: 'skill', source: `acme/skills@${head}#skills/tidy`, licence: 'MIT', sha256: sha(SKILL), tags: ['notes'], eval: null },
      { id: 'mine', kind: 'skill', source: 'blueprint@HEAD#plugins/g/skills/mine', licence: 'Apache-2.0', sha256: sha('x'), tags: ['notes'], eval: null },
    ]),
    [`${dir}/LICENSE`]: LICENSE,
    [`${dir}/SKILL.md`]: SKILL,
    'plugins/g/skills/mine/SKILL.md': 'own text\n',
  });
  return { base, root };
}
const read = (root, rel) => readFileSync(join(root, rel), 'utf8');

test('on a clean tree it writes nothing and never contacts the upstream', async () => {
  const { root } = setup();
  const source = { fetchFile: async () => assert.fail('fetched on a clean tree'), resolveHead: async () => assert.fail('resolved') };
  const r = await buildPlugin({ root, source });
  assert.deepEqual(r, { written: [], problems: [] });
});

test('a deleted or edited copy is regenerated from the pinned commit', async () => {
  const { base, root } = setup();
  rmSync(join(root, dir, 'LICENSE'));
  writeFileSync(join(root, dir, 'SKILL.md'), 'edited\n');
  const r = await buildPlugin({ root, source: gitSource(base) });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.written.sort(), [`${dir}/LICENSE`, `${dir}/SKILL.md`]);
  assert.equal(read(root, `${dir}/SKILL.md`), SKILL);
  assert.equal(read(root, `${dir}/LICENSE`), LICENSE);
});

test('upstream bytes that do not match the pin are refused and not written', async () => {
  const { root } = setup();
  writeFileSync(join(root, dir, 'SKILL.md'), 'edited\n');
  const source = { fetchFile: async () => Buffer.from('tampered\n') };
  const r = await buildPlugin({ root, source });
  assert.equal(r.written.length, 0);
  assert.match(r.problems[0], /does not match the pin/);
  assert.equal(read(root, `${dir}/SKILL.md`), 'edited\n');
});

test('own skills are never touched', async () => {
  const { base, root } = setup();
  writeFileSync(join(root, 'plugins/g/skills/mine/SKILL.md'), 'changed own text\n');
  await buildPlugin({ root, source: gitSource(base) });
  assert.equal(read(root, 'plugins/g/skills/mine/SKILL.md'), 'changed own text\n');
});

test('the CLI run on the real clean tree changes nothing', () => {
  const before = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout;
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-plugin.mjs')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, UPGRADE_PINS_BASE: '/nonexistent' } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 written, 0 problem/);
  assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout, before);
});
