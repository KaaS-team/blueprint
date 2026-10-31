import { test } from 'node:test';
import { assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-prose.mjs';
const EM_DASH = '—';

test('fails when a README contains an em dash', () => {
  assertFails(SCRIPT, fixture({ 'README.md': `a ${EM_DASH} b\n` }), /README\.md/);
});

test('passes when no scanned file contains an em dash', () => {
  assertPasses(SCRIPT, fixture({ 'README.md': 'a - b\n' }));
});

test('fails when NOTICE contains an em dash, because NOTICE is prose-scanned', () => {
  assertFails(SCRIPT, fixture({ NOTICE: `credit ${EM_DASH} MIT\n`, 'README.md': 'ok\n' }), /NOTICE/);
});

const vendoredPin = (to) => JSON.stringify([{ repo: 'o/r', sha: 'a'.repeat(40), licence: 'MIT', files: [{ from: 'x', to, sha256: 'b'.repeat(64) }] }]);

test('passes a vendored file that contains an em dash', () => {
  assertPasses(SCRIPT, fixture({ 'docs/up.md': `a ${EM_DASH} b\n`, 'upstreams.json': vendoredPin('docs/up.md') }));
});

test('fails the same file when it is not listed in upstreams.json', () => {
  assertFails(SCRIPT, fixture({ 'docs/up.md': `a ${EM_DASH} b\n` }), /docs\/up\.md/);
});
