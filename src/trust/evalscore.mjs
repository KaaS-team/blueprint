// Turns an eval report into one score per skill. Reports come from the nightly run
// (scripts/nightly-evals.sh) under the operator's own login. The gate makes no model calls.
//
// Accepted report shape (one file per plugin group):
//   { "cases": [ { "name": "<skill>--<case>", "score": 0.0 to 1.0 } ] }
// "pass": true or false is read as 1 or 0 when "score" is absent.

export function caseScore(c) {
  if (typeof c.score === 'number' && c.score >= 0 && c.score <= 1) return c.score;
  if (typeof c.pass === 'boolean') return c.pass ? 1 : 0;
  return null;
}

// Returns Map skill -> { score, cases } with the score rounded to two decimals.
export function scoresFromReport(report) {
  const bySkill = new Map();
  for (const c of report?.cases ?? []) {
    const skill = String(c.name ?? '').split('--')[0];
    const s = caseScore(c);
    if (!skill || s === null) continue;
    if (!bySkill.has(skill)) bySkill.set(skill, []);
    bySkill.get(skill).push(s);
  }
  const out = new Map();
  for (const [skill, list] of bySkill) {
    out.set(skill, { score: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100, cases: list.length });
  }
  return out;
}
