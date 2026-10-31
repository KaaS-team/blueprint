import { test } from 'node:test';
import { assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-mutations.mjs';
const BITING = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('rule is on', () => assert.equal(readFileSync('rule.txt', 'utf8').trim(), 'on'));
`;
const TOOTHLESS = `import { test } from 'node:test';
test('always passes', () => {});
`;
const mutation = (extra = {}) =>
  JSON.stringify([{ file: 'rule.txt', search: 'on', replace: 'off', test: 'tests/t.test.mjs', ...extra }]);

test('passes when the mutated run fails', () => {
  assertPasses(SCRIPT, fixture({ 'rule.txt': 'on\n', 'tests/t.test.mjs': BITING, 'tests/mutations.json': mutation() }));
});

test('fails when the test still passes under the mutation', () => {
  assertFails(SCRIPT, fixture({ 'rule.txt': 'on\n', 'tests/t.test.mjs': TOOTHLESS, 'tests/mutations.json': mutation() }), /survived/);
});

test('fails when the test is already failing without the mutation', () => {
  assertFails(SCRIPT, fixture({ 'rule.txt': 'off\n', 'tests/t.test.mjs': BITING, 'tests/mutations.json': mutation({ search: 'off', replace: 'x' }) }), /unmutated/);
});

test('fails when search does not occur exactly once', () => {
  assertFails(SCRIPT, fixture({ 'rule.txt': 'on on\n', 'tests/t.test.mjs': BITING, 'tests/mutations.json': mutation() }), /exactly 1/);
});

test('runs entries from tests/mutations/*.json', () => {
  assertFails(SCRIPT, fixture({ 'rule.txt': 'on\n', 'tests/t.test.mjs': TOOTHLESS, 'tests/mutations/extra.json': mutation() }), /survived/);
});
