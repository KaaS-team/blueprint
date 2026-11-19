import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ROOT } from './helpers.mjs';

const BIN = join(ROOT, 'bin', 'kaas-blueprint.mjs');
const GO_REPO = join(ROOT, 'tests', 'fixtures', 'go-repo');

async function connect() {
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [BIN, 'mcp'] }));
  return client;
}
const call = async (client, name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return { error: r.isError === true, text: r.content[0].text };
};

test('the server lists its four tools, searches, gets and recommends', async () => {
  const client = await connect();
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ['get_skill', 'install_skill', 'recommend_for_repo', 'search_skills']);

    const found = JSON.parse((await call(client, 'search_skills', { query: 'debugging' })).text);
    assert.equal(found[0].id, 'systematic-debugging');
    const tagged = JSON.parse((await call(client, 'search_skills', { tags: ['ui'] })).text);
    assert.ok(tagged.length > 0 && tagged.every((s) => s.tags.includes('ui')));

    const got = JSON.parse((await call(client, 'get_skill', { id: 'systematic-debugging' })).text);
    assert.match(got.skill_md, /^---\nname: systematic-debugging/);
    assert.match(got.pin.source, /@[0-9a-f]{40}#/);
    assert.match(got.pin.sha256, /^[0-9a-f]{64}$/);
    assert.equal((await call(client, 'get_skill', { id: 'nope' })).error, true);

    const rec = JSON.parse((await call(client, 'recommend_for_repo', { path: GO_REPO })).text);
    assert.ok(rec.evidence.includes('go.mod'));
    assert.ok(rec.evidence.includes('.github/workflows/ci.yml'));
    const top = rec.recommendations.slice(0, 3).map((r) => r.id);
    assert.ok(top.includes('verification-before-completion'), top.join());
    const ui = rec.recommendations.findIndex((r) => r.tags.includes('ui'));
    assert.ok(ui === -1 || ui > 2, 'UI skills must not lead for a Go repo');
  } finally {
    await client.close();
  }
});

test('install_skill writes the right folder for each agent', async () => {
  const table = [
    ['claude', '.claude/skills'],
    ['codex', '.codex/skills'],
    ['cursor', '.cursor/skills'],
    ['gemini', '.gemini/skills'],
  ];
  const client = await connect();
  try {
    for (const [agent, dir] of table) {
      const project = mkdtempSync(join(tmpdir(), 'mcp-install-'));
      const r = await call(client, 'install_skill', { id: 'grilling', agent, project_dir: project });
      assert.equal(r.error, false, r.text);
      assert.ok(existsSync(join(project, dir, 'grilling', 'SKILL.md')), `${agent}: ${r.text}`);
      const again = await call(client, 'install_skill', { id: 'grilling', agent, project_dir: project });
      assert.equal(again.error, true, 'second install must refuse without force');
      assert.equal((await call(client, 'install_skill', { id: 'grilling', agent, project_dir: project, force: true })).error, false);
    }
    assert.equal((await call(client, 'install_skill', { id: 'nope', agent: 'claude' })).error, true);
  } finally {
    await client.close();
  }
});
