#!/usr/bin/env node
import { readFileSync } from 'node:fs';

// Builds the FACTORY_GATES line from a list of checks: [{ name, pass, skipped? }].
export function gateLine(checks) {
  if (!Array.isArray(checks) || checks.length === 0 || checks.some((c) => typeof c?.name !== 'string' || !c.name)) {
    return { line: 'FACTORY_GATES: status=MISCONFIGURED passed=0 failed=0 skipped=0 failed_gates=checks-invalid', code: 2 };
  }
  const skipped = checks.filter((c) => c.skipped === true);
  const run = checks.filter((c) => c.skipped !== true);
  const failed = run.filter((c) => c.pass !== true);
  const passed = run.length - failed.length;
  if (run.length === 0) {
    return { line: `FACTORY_GATES: status=MISCONFIGURED passed=0 failed=0 skipped=${skipped.length} failed_gates=no-checks-run`, code: 2 };
  }
  const status = failed.length ? 'FAIL' : 'PASS';
  const names = failed.map((c) => c.name.replace(/[\s,]+/g, '-')).join(',');
  return { line: `FACTORY_GATES: status=${status} passed=${passed} failed=${failed.length} skipped=${skipped.length} failed_gates=${names}`, code: failed.length ? 1 : 0 };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let checks;
  try {
    checks = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  } catch {
    checks = null;
  }
  const { line, code } = gateLine(checks);
  console.log(line);
  process.exit(code);
}
