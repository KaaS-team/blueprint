import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT, fixture } from './helpers.mjs';
import { gitSource, upgradePins } from '../scripts/upgrade-pins.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

// A bare upstream under <base>/acme/skills with one commit, returned with a helper that adds another.
function upstream(files) {
  const base = mkdtempSync(join(tmpdir(), 'upstream-'));
  const bare = join(base, 'acme', 'skills');
  const work = mkdtempSync(join(tmpdir(), 'upstream-work-'));
  mkdirSync(bare, { recursive: true });
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(work, 'init', '-q', '-b', 'main');
  const commit = (next) => {
    for (const [rel, body] of Object.entries(next)) {
      mkdirSync(dirname(join(work, rel)), { recursive: true });
      writeFileSync(join(work, rel), body);
    }
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'c');
    git(work, 'push', '-q', bare, 'main');
    return git(work, 'rev-parse', 'HEAD');
  };
  return { base, commit, first: commit(files) };
}

const LICENSE = 'MIT licence text\n';
const skillText = (desc) => `---\nname: tidy\ndescription: ${desc}\n---\nBody\n`;
const DESC = 'Use when you must tidy a folder of notes';

// A blueprint-shaped repo that vendors the upstream's skill at sha.
function blueprint(sha1, skill) {
  const dir = 'plugins/g/skills/tidy';
  return fixture({
    'upstreams.json': JSON.stringify([
      {
        repo: 'acme/skills',
        sha: sha1,
        licence: 'MIT',
        files: [
          { from: 'LICENSE', to: `${dir}/LICENSE`, sha256: sha(LICENSE) },
          { from: 'skills/tidy/SKILL.md', to: `${dir}/SKILL.md`, sha256: sha(skill) },
        ],
      },
    ]),
    NOTICE: `acme/skills at ${sha1}\nFiles: tidy\n`,
    [`${dir}/LICENSE`]: LICENSE,
    [`${dir}/SKILL.md`]: skill,
    'routing/tidy.json': JSON.stringify({
      skill: 'tidy',
      positive: ['tidy my notes folder', 'tidy a folder of notes', 'notes folder tidy'],
      negative: [
        { prompt: 'bake bread dough', expect: 'bake' },
        { prompt: 'bake the oven loaf', expect: 'bake' },
      ],
    }),
    'routing/bake.json': JSON.stringify({
      skill: 'bake',
      positive: ['bake bread dough', 'bake the oven loaf', 'oven bake flour'],
      negative: [
        { prompt: 'tidy my notes folder', expect: 'tidy' },
        { prompt: 'tidy a folder of notes', expect: 'tidy' },
      ],
    }),
    'plugins/g/skills/bake/SKILL.md': '---\nname: bake\ndescription: Use when you bake bread dough in the oven with flour\n---\nBody\n',
    'plugins/g/evals/bake--basic/prompt.md': '---\nmax_turns: 3\n---\nBake bread.\n',
    'plugins/g/evals/bake--basic/graders/a.md': '---\ntype: tool_used\ntool: Skill\ninput_match: bake\n---\nfired\n',
    'plugins/g/evals/bake--basic/graders/b.md': '---\ntype: regex\npattern: bake\n---\nsaid\n',
    'plugins/g/evals/tidy--basic/prompt.md': '---\nmax_turns: 3\n---\nTidy my notes.\n',
    'plugins/g/evals/tidy--basic/graders/a.md': '---\ntype: tool_used\ntool: Skill\ninput_match: tidy\n---\nfired\n',
    'plugins/g/evals/tidy--basic/graders/b.md': '---\ntype: regex\npattern: tidy\n---\nsaid\n',
  });
}
const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
const run = (root, base, opts = {}) => upgradePins({ root, source: gitSource(base), ...opts });

test('a changed upstream file is bumped when the offline checks pass', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const root = blueprint(up.first, old);
  const fresh = skillText(`${DESC} and sort them`);
  const head = up.commit({ 'skills/tidy/SKILL.md': fresh });
  const [r] = await run(root, up.base);
  assert.equal(r.status, 'bumped', JSON.stringify(r));
  const pin = JSON.parse(read(root, 'upstreams.json'))[0];
  assert.equal(pin.sha, head);
  assert.equal(pin.files[1].sha256, sha(fresh));
  assert.equal(read(root, 'plugins/g/skills/tidy/SKILL.md'), fresh);
  assert.match(read(root, 'NOTICE'), new RegExp(`acme/skills at ${head}`));
});

test('a bump that breaks an offline check is held and leaves the pin and bytes alone', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const root = blueprint(up.first, old);
  const pinsBefore = read(root, 'upstreams.json');
  up.commit({ 'skills/tidy/SKILL.md': '---\nname: tidy-up\ndescription: Use when you wash dishes\n---\nBody\n' });
  const [r] = await run(root, up.base);
  assert.equal(r.status, 'held');
  assert.match(r.reason, /FAIL/);
  assert.equal(read(root, 'upstreams.json'), pinsBefore);
  assert.equal(read(root, 'plugins/g/skills/tidy/SKILL.md'), old);
  assert.match(read(root, 'NOTICE'), new RegExp(`acme/skills at ${up.first}`));
});

test('--dry-run reports the plan and writes nothing', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const root = blueprint(up.first, old);
  const pinsBefore = read(root, 'upstreams.json');
  up.commit({ 'skills/tidy/SKILL.md': skillText(`${DESC} and sort them`) });
  const lines = [];
  const [r] = await run(root, up.base, { dryRun: true, log: (l) => lines.push(l) });
  assert.equal(r.status, 'would-bump');
  assert.match(lines.join('\n'), /would bump acme\/skills/);
  assert.equal(read(root, 'upstreams.json'), pinsBefore);
  assert.equal(read(root, 'plugins/g/skills/tidy/SKILL.md'), old);
});

test('an upstream that has not moved is current', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const root = blueprint(up.first, old);
  const [r] = await run(root, up.base);
  assert.equal(r.status, 'current');
});

test('a new commit that leaves the pinned files identical keeps the pin', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const root = blueprint(up.first, old);
  const pinsBefore = read(root, 'upstreams.json');
  up.commit({ 'other.md': 'unrelated\n' });
  const [r] = await run(root, up.base);
  assert.equal(r.status, 'current');
  assert.equal(read(root, 'upstreams.json'), pinsBefore);
});

test('a pinned file removed upstream is held with the reason', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const root = blueprint(up.first, old);
  const work = join(up.base, 'acme', 'skills');
  const clone = mkdtempSync(join(tmpdir(), 'clone-'));
  git(clone, 'clone', '-q', work, '.');
  git(clone, 'rm', '-q', 'skills/tidy/SKILL.md');
  git(clone, 'commit', '-q', '-m', 'drop');
  git(clone, 'push', '-q', 'origin', 'main');
  const [r] = await run(root, up.base);
  assert.equal(r.status, 'held');
  assert.match(r.reason, /SKILL\.md/);
});

test('the CLI honours --dry-run against a local upstream base', () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  up.commit({ 'skills/tidy/SKILL.md': skillText(`${DESC} and sort them`) });
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'upgrade-pins.mjs'), '--dry-run'], {
    env: { ...process.env, UPGRADE_PINS_BASE: up.base },
    encoding: 'utf8',
  });
  // The real pins name other repos, which the local base lacks, so every pin is held rather than bumped.
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /held/);
});

// The eval rule compares against a git base, so the fixture is committed and EVAL_BASE points at that commit.
function withCatalogue(old, up) {
  const root = blueprint(up.first, old);
  const body = JSON.stringify([
    { id: 'tidy', kind: 'skill', source: `acme/skills@${up.first}#skills/tidy`, licence: 'MIT', sha256: sha(old), tags: ['notes'], eval: 'plugins/g/evals/tidy--basic/prompt.md', score: null },
    { id: 'bake', kind: 'skill', source: `blueprint@${up.first}#plugins/g/skills/bake`, licence: 'Apache-2.0', sha256: sha(read(root, 'plugins/g/skills/bake/SKILL.md')), tags: ['food'], eval: 'plugins/g/evals/bake--basic/prompt.md', score: null },
  ]);
  mkdirSync(join(root, 'catalogue'), { recursive: true });
  writeFileSync(join(root, 'catalogue/catalogue.json'), body);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return { root, base: git(root, 'rev-parse', 'HEAD') };
}
async function withBase(base, fn) {
  const saved = process.env.EVAL_BASE;
  process.env.EVAL_BASE = base;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.EVAL_BASE;
    else process.env.EVAL_BASE = saved;
  }
}

test('a bumped SKILL.md gets its eval file hash updated in the same change, so check-evals passes', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const { root, base } = withCatalogue(old, up);
  const fresh = skillText(`${DESC} and sort them`);
  const head = up.commit({ 'skills/tidy/SKILL.md': fresh });
  const [r] = await withBase(base, () => run(root, up.base));
  assert.equal(r.status, 'bumped', JSON.stringify(r));
  assert.match(read(root, 'plugins/g/evals/tidy--basic/prompt.md'), new RegExp(`^skill_sha256: ${sha(fresh)}$`, 'm'));
  assert.match(read(root, 'plugins/g/evals/tidy--basic/prompt.md'), /max_turns: 3/);
  assert.doesNotMatch(read(root, 'plugins/g/evals/bake--basic/prompt.md'), /skill_sha256/);
  const entry = JSON.parse(read(root, 'catalogue/catalogue.json')).find((e) => e.id === 'tidy');
  assert.equal(entry.source, `acme/skills@${head}#skills/tidy`);
  assert.equal(entry.sha256, sha(fresh));
});

test('a second bump replaces the eval hash instead of adding another line', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const { root, base } = withCatalogue(old, up);
  up.commit({ 'skills/tidy/SKILL.md': skillText(`${DESC} and sort them`) });
  await withBase(base, () => run(root, up.base));
  const third = skillText(`${DESC} and archive them`);
  up.commit({ 'skills/tidy/SKILL.md': third });
  const [r] = await withBase(base, () => run(root, up.base));
  assert.equal(r.status, 'bumped', JSON.stringify(r));
  const prompt = read(root, 'plugins/g/evals/tidy--basic/prompt.md');
  assert.equal(prompt.match(/skill_sha256/g).length, 1);
  assert.match(prompt, new RegExp(sha(third)));
});

test('a held bump restores the eval file and the catalogue', async () => {
  const old = skillText(DESC);
  const up = upstream({ LICENSE, 'skills/tidy/SKILL.md': old });
  const { root, base } = withCatalogue(old, up);
  const promptBefore = read(root, 'plugins/g/evals/tidy--basic/prompt.md');
  const catBefore = read(root, 'catalogue/catalogue.json');
  up.commit({ 'skills/tidy/SKILL.md': '---\nname: tidy-up\ndescription: Use when you wash dishes\n---\nBody\n' });
  const [r] = await withBase(base, () => run(root, up.base));
  assert.equal(r.status, 'held');
  assert.equal(read(root, 'plugins/g/evals/tidy--basic/prompt.md'), promptBefore);
  assert.equal(read(root, 'catalogue/catalogue.json'), catBefore);
});
