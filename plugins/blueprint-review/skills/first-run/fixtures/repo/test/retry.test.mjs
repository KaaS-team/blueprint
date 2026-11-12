import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retry } from '../src/retry.mjs';

test('retry returns the first success', async () => {
  assert.equal(await retry(async () => 'ok'), 'ok');
});
