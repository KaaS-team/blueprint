import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-vendor.mjs';
const SHA = 'c'.repeat(40);
const dir = 'plugins/blueprint-core/skills/demo';
const sum = (s) => createHash('sha256').update(s).digest('hex');
const SKILL_MD = '---\nname: demo\ndescription: x\n---\n';
const LICENSE = 'MIT License\n';

function files(overrides = {}) {
  const pin = { repo: 'o/r', sha: SHA, licence: 'MIT', ...overrides.pin };
  pin.files = [
    { from: 'SKILL.md', to: `${dir}/SKILL.md`, sha256: sum(SKILL_MD) },
    { from: 'LICENSE', to: `${dir}/LICENSE`, sha256: sum(LICENSE) },
  ];
  return {
    [`${dir}/SKILL.md`]: SKILL_MD,
    [`${dir}/LICENSE`]: LICENSE,
    'upstreams.json': JSON.stringify([pin]),
    NOTICE: `o/r at ${SHA}\n`,
    ...overrides.files,
  };
}

test('passes a clean fixture', () => {
  assertPasses(SCRIPT, fixture(files()));
});

test('fails when one byte changed', () => {
  assertFails(SCRIPT, fixture(files({ files: { [`${dir}/SKILL.md`]: `${SKILL_MD}x` } })), /bytes differ/);
});

test('fails on an unlisted file in the skill folder', () => {
  assertFails(SCRIPT, fixture(files({ files: { [`${dir}/extra.md`]: 'x' } })), /extra\.md/);
});

test('fails on a 39 character sha', () => {
  assertFails(SCRIPT, fixture(files({ pin: { sha: 'c'.repeat(39) }, files: { NOTICE: `o/r at ${'c'.repeat(39)}\n` } })), /40/);
});

test('fails on a non-MIT licence', () => {
  assertFails(SCRIPT, fixture(files({ pin: { licence: 'GPL-3.0' } })), /licence/);
});

test('fails when NOTICE lacks the sha', () => {
  assertFails(SCRIPT, fixture(files({ files: { NOTICE: 'o/r\n' } })), /NOTICE/);
});
