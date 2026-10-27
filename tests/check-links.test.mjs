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
