import { test } from 'node:test';
import { assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-structure.mjs';
const GOOD = 'Reviews pull requests. Use when a diff needs a second pair of eyes.';
const skill = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;
const SKILL = 'plugins/blueprint-core/skills/review-diff/SKILL.md';

test('passes a well-formed skill', () => {
  assertPasses(SCRIPT, fixture({ [SKILL]: skill('review-diff', GOOD) }));
});

test('fails when frontmatter name differs from the folder name', () => {
  assertFails(SCRIPT, fixture({ [SKILL]: skill('review', GOOD) }), /review-diff/);
});

test('fails when the description has no "Use when"', () => {
  assertFails(SCRIPT, fixture({ [SKILL]: skill('review-diff', 'Reviews pull requests.') }), /Use when/);
});

test('fails when the description is over 1024 characters', () => {
  const long = `${GOOD} ${'x'.repeat(1024)}`;
  assertFails(SCRIPT, fixture({ [SKILL]: skill('review-diff', long) }), /1024/);
});

test('passes a description of exactly 1024 characters', () => {
  const exact = `Use when ${'x'.repeat(1024 - 'Use when '.length)}`;
  assertPasses(SCRIPT, fixture({ [SKILL]: skill('review-diff', exact) }));
});

test('fails a skill with no frontmatter', () => {
  assertFails(SCRIPT, fixture({ [SKILL]: '# review-diff\n' }), /frontmatter/);
});

test('fails when a README mentions KaaS', () => {
  assertFails(SCRIPT, fixture({ 'README.md': 'Built by KaaS.\n' }), /README\.md/);
});

test('fails when a README mentions LWP or learnwithparam in any case', () => {
  assertFails(SCRIPT, fixture({ 'README.md': 'See LearnWithParam.\n' }), /README\.md/);
  assertFails(SCRIPT, fixture({ 'README.md': 'Via lwp.\n' }), /README\.md/);
});

test('passes the same KaaS text in NOTICE', () => {
  assertPasses(SCRIPT, fixture({ NOTICE: 'Built by KaaS.\n', 'README.md': 'Hello.\n' }));
});

test('passes kaas.team alone', () => {
  assertPasses(SCRIPT, fixture({ 'README.md': 'Book a call at kaas.team\n' }));
});

test('passes the kaas-blueprint command name', () => {
  assertPasses(SCRIPT, fixture({ 'README.md': 'npx kaas-blueprint add plan-critic\n' }));
});

test('fails another kaas- word', () => {
  assertFails(SCRIPT, fixture({ 'README.md': 'kaas-tools\n' }), /README\.md/);
});

test('does not scan the check scripts or tests, which spell the banned words out', () => {
  assertPasses(SCRIPT, fixture({ 'tests/x.mjs': 'KaaS LWP\n', 'scripts/y.mjs': 'KaaS\n' }));
});

const vendoredPin = (to) => JSON.stringify([{ repo: 'o/r', sha: 'a'.repeat(40), licence: 'MIT', files: [{ from: 'x', to, sha256: 'b'.repeat(64) }] }]);

test('passes a vendored skill whose description has no "Use when"', () => {
  assertPasses(SCRIPT, fixture({ [SKILL]: skill('review-diff', 'Reviews pull requests.'), 'upstreams.json': vendoredPin(SKILL) }));
});

test('fails the same skill when it is not listed in upstreams.json', () => {
  assertFails(SCRIPT, fixture({ [SKILL]: skill('review-diff', 'Reviews pull requests.') }), /Use when/);
});

test('a vendored skill still needs its name to match the folder', () => {
  assertFails(SCRIPT, fixture({ [SKILL]: skill('review', 'Reviews pull requests.'), 'upstreams.json': vendoredPin(SKILL) }), /review-diff/);
});

test('a vendored file that names the company still fails', () => {
  assertFails(SCRIPT, fixture({ 'docs/up.md': 'kaas\n', 'upstreams.json': vendoredPin('docs/up.md') }), /docs\/up\.md/);
});
