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
