import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_ROOT as root, upstreams } from './lib.mjs';

// Usage: sync-upstream.mjs [repo]. Fetches each pinned file, writes it only when its sha256 matches the pin.
const only = process.argv[2];
let failed = false;

for (const u of upstreams(root).filter((x) => !only || x.repo === only)) {
  for (const f of u.files) {
    const url = `https://raw.githubusercontent.com/${u.repo}/${u.sha}/${f.from}`;
    try {
      const res = await fetch(url);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const got = createHash('sha256').update(bytes).digest('hex');
      if (got !== f.sha256) throw new Error(`sha256 ${got} does not match the pin`);
      mkdirSync(dirname(join(root, f.to)), { recursive: true });
      writeFileSync(join(root, f.to), bytes);
      console.log(`ok ${f.to}`);
    } catch (e) {
      console.log(`FAIL ${u.repo} ${f.from}: ${e.message}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
