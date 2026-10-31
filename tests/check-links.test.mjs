import { test } from 'node:test';
import { assertFails, assertPasses, fixture } from './helpers.mjs';

const SCRIPT = 'check-links.mjs';

test('fails on a relative link to a file that does not exist', () => {
  assertFails(SCRIPT, fixture({ 'README.md': 'See [guide](docs/guide.md).\n' }), /docs\/guide\.md/);
});

test('passes a relative link to a file that exists', () => {
  assertPasses(SCRIPT, fixture({ 'README.md': 'See [guide](docs/guide.md).\n', 'docs/guide.md': '# Guide\n' }));
});

test('passes a relative link with a fragment when the file exists', () => {
  assertPasses(SCRIPT, fixture({ 'README.md': '[g](docs/guide.md#intro)\n', 'docs/guide.md': '# Guide\n' }));
});

test('does not fetch http, https or mailto links, nor check same-page anchors', () => {
  assertPasses(SCRIPT, fixture({
    'README.md': '[site](https://example.invalid/x) [web](http://example.invalid/y) [mail](mailto:a@example.invalid) [top](#top)\n',
  }));
});

const vendoredPin = (to) => JSON.stringify([{ repo: 'o/r', sha: 'a'.repeat(40), licence: 'MIT', files: [{ from: 'x', to, sha256: 'b'.repeat(64) }] }]);

test('passes a vendored markdown file with a dead link', () => {
  assertPasses(SCRIPT, fixture({ 'docs/up.md': '[x](./missing.md)\n', 'upstreams.json': vendoredPin('docs/up.md') }));
});

test('fails the same file when it is not listed in upstreams.json', () => {
  assertFails(SCRIPT, fixture({ 'docs/up.md': '[x](./missing.md)\n' }), /missing\.md/);
});
