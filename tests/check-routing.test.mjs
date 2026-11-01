import { test } from 'node:test';
import { assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-routing.mjs';
const G = 'plugins/blueprint-core';
const skill = (name, desc) => ({ [`${G}/skills/${name}/SKILL.md`]: `---\nname: ${name}\ndescription: ${desc}\n---\n` });
const SKILLS = {
  ...skill('grilling', 'Grill the user about a plan. Use when stress-testing a decision.'),
  ...skill('debugging', 'Use when a bug or test failure needs its root cause found.'),
};
const GRILL = ['Grill me on this plan', 'Stress-test my decision', 'Grill this idea hard'];
const DEBUG = ['Find the root cause of this bug', 'This test failure needs debugging', 'Debug the failure in my test'];
const routing = (data) => ({ [`${G}/evals/routing.json`]: JSON.stringify(data) });

test('prompts that reach their skill pass', () => {
  assertPasses(SCRIPT, fixture({ ...SKILLS, ...routing({ grilling: GRILL, debugging: DEBUG }) }));
});

test('a skill with too few routing prompts fails', () => {
  assertFails(SCRIPT, fixture({ ...SKILLS, ...routing({ grilling: GRILL, debugging: DEBUG.slice(0, 1) }) }), /debugging: 1 routing prompt/);
});

test('a skill with no routing entry fails', () => {
  assertFails(SCRIPT, fixture({ ...SKILLS, ...routing({ grilling: GRILL }) }), /debugging: 0 routing prompt/);
});

test('an entry naming an unknown skill fails', () => {
  assertFails(SCRIPT, fixture({ ...SKILLS, ...routing({ grilling: GRILL, debugging: DEBUG, ghost: GRILL }) }), /ghost names no skill/);
});

test('prompts that reach the wrong skill drop the rate under 90 percent', () => {
  const swapped = routing({ grilling: DEBUG, debugging: GRILL });
  assertFails(SCRIPT, fixture({ ...SKILLS, ...swapped }), /picked first, needs 90%/);
});

test('invalid JSON fails', () => {
  assertFails(SCRIPT, fixture({ ...SKILLS, [`${G}/evals/routing.json`]: '{nope' }), /not valid JSON/);
});
