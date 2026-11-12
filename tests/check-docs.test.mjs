import { test } from 'node:test';
import { assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-docs.mjs';
const MAKEFILE = '.PHONY: check\ncheck:\n\ttrue\n';
const block = (lang, body) => `# T\n\n\`\`\`${lang}\n${body}\n\`\`\`\n`;

test('fails when a README sh block runs a make target that does not exist', () => {
  assertFails(SCRIPT, fixture({ Makefile: MAKEFILE, 'README.md': block('sh', 'make nope') }), /make nope/);
});

test('passes a make target that exists', () => {
  assertPasses(SCRIPT, fixture({ Makefile: MAKEFILE, 'README.md': block('sh', '$ make check') }));
});

test('fails when a bash block runs a node script that does not exist', () => {
  assertFails(SCRIPT, fixture({ Makefile: MAKEFILE, 'README.md': block('bash', 'node scripts/gone.mjs --dry-run') }), /scripts\/gone\.mjs/);
});

test('fails on a missing ./script and a missing bash script', () => {
  assertFails(SCRIPT, fixture({ Makefile: MAKEFILE, 'README.md': block('sh', './run.sh') }), /run\.sh/);
  assertFails(SCRIPT, fixture({ Makefile: MAKEFILE, 'README.md': block('sh', 'bash tools/x.sh') }), /tools\/x\.sh/);
});

test('passes a node script that exists', () => {
  assertPasses(SCRIPT, fixture({ Makefile: MAKEFILE, 'scripts/a.mjs': '', 'README.md': block('sh', 'node scripts/a.mjs --x') }));
});

test('ignores blocks in other languages and commands that are not scripts or targets', () => {
  assertPasses(SCRIPT, fixture({ Makefile: MAKEFILE, 'README.md': block('json', 'make nope') + block('sh', 'npm pack\ngit status') }));
});

test('fails when the README names make but there is no Makefile', () => {
  assertFails(SCRIPT, fixture({ 'README.md': block('sh', 'make check') }), /make check/);
});
