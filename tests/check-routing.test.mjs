import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertPasses, fixture } from './helpers.mjs';
import { rank, tokenize } from '../scripts/routing-rank.mjs';

const SCRIPT = 'check-routing.mjs';
const skillPath = (n) => `plugins/g/skills/${n}/SKILL.md`;
const routePath = (n) => `routing/${n}.json`;

test('tokenize lowercases, splits on non-letters and drops short and stop words', () => {
  assert.deepEqual(tokenize('The Quick-brown fox, is 42 up!'), ['quick', 'brown', 'fox']);
});

test('rank puts the obvious skill first', () => {
  const docs = [
    { name: 'baking', text: 'bake bread dough oven flour' },
    { name: 'plumbing', text: 'pipe leak faucet drain wrench' },
  ];
  assert.deepEqual(rank(docs, 'my faucet has a leak'), ['plumbing', 'baking']);
});

test('rank breaks ties by name', () => {
  const docs = [
    { name: 'beta', text: 'alpha' },
    { name: 'alpha', text: 'alpha' },
  ];
  assert.deepEqual(rank(docs, 'alpha'), ['alpha', 'beta']);
});

const pos = {
  baking: ['bake some bread', 'knead the dough', 'heat the oven for flour'],
  plumbing: ['fix the leak', 'the faucet drips', 'a pipe is blocked'],
};
const neg = {
  baking: [{ prompt: 'drain the pipe', expect: 'plumbing' }, { prompt: 'wrench the leak', expect: 'baking-not' }],
};

function route(skill, over = {}) {
  const other = skill === 'baking' ? 'plumbing' : 'baking';
  return JSON.stringify({
    skill,
    positive: pos[skill],
    negative: [{ prompt: skill === 'baking' ? 'drain the pipe' : 'bake the bread', expect: other }, { prompt: skill === 'baking' ? 'a faucet leak' : 'flour dough', expect: other }],
    ...over,
  });
}

function files(over = {}) {
  const base = {
    [skillPath('baking')]: '---\nname: baking\ndescription: Bake bread with dough, flour and an oven.\n---\n',
    [skillPath('plumbing')]: '---\nname: plumbing\ndescription: Fix a leak, faucet or pipe and drain.\n---\n',
    [routePath('baking')]: route('baking'),
    [routePath('plumbing')]: route('plumbing'),
  };
  for (const [k, v] of Object.entries(over)) {
    if (v === null) delete base[k];
    else base[k] = v;
  }
  return base;
}

test('a routed corpus passes', () => assertPasses(SCRIPT, fixture(files())));

test('a skill with no routing file fails', () => {
  assertFails(SCRIPT, fixture(files({ [routePath('plumbing')]: null })), /plumbing: no routing\/plumbing\.json/);
});

test('a skill with 2 positives fails', () => {
  const dir = fixture(files({ [routePath('baking')]: route('baking', { positive: pos.baking.slice(0, 2) }) }));
  assertFails(SCRIPT, dir, /baking has 2 positive prompts/);
});

test('a skill with 1 negative fails', () => {
  const dir = fixture(files({ [routePath('baking')]: route('baking', { negative: [{ prompt: 'drain the pipe', expect: 'plumbing' }] }) }));
  assertFails(SCRIPT, dir, /baking has 1 negative prompts/);
});

test('a routing file for a missing skill fails', () => {
  const dir = fixture(files({ [routePath('ghost')]: route('ghost') }));
  assertFails(SCRIPT, dir, /skill "ghost" does not exist/);
});

test('a negative expecting a missing skill fails', () => {
  const dir = fixture(files({ [routePath('baking')]: route('baking', { negative: [{ prompt: 'a', expect: 'ghost' }, { prompt: 'b', expect: 'plumbing' }] }) }));
  assertFails(SCRIPT, dir, /negative expect "ghost" does not exist/);
});

test('a negative expecting its own skill fails', () => {
  const dir = fixture(files({ [routePath('baking')]: route('baking', { negative: [{ prompt: 'a', expect: 'baking' }, { prompt: 'b', expect: 'plumbing' }] }) }));
  assertFails(SCRIPT, dir, /negative expect equals the skill baking/);
});

test('a positive moved to the wrong skill fails and lists the misses', () => {
  const dir = fixture(files({ [routePath('baking')]: route('baking', { positive: ['fix the leak', 'the faucet drips', 'a pipe is blocked'] }) }));
  assertFails(SCRIPT, dir, /accuracy[\s\S]*miss: "fix the leak" expected baking, got plumbing/);
});
