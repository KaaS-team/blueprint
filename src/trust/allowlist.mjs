// Builds the admin allowlist as a Claude Code managed settings fragment.
// Admins merge it into managed-settings.json. Only catalogue skills that pass the bar are listed,
// and plugins can only come from the marketplaces the admin names.

// A skill is allowed when its scan score is at least minSecurity and, if it has an eval score, that is at least minEval.
export function allowedSkills(entries, { minSecurity = 80, minEval = 0 } = {}) {
  return entries
    .filter((e) => e.kind === 'skill')
    .filter((e) => (e.security?.score ?? 0) >= minSecurity)
    .filter((e) => e.score === null || e.score === undefined || e.score >= minEval)
    .map((e) => e.id)
    .sort();
}

// marketplaces: [{ source: 'github', repo: 'owner/name' }]
export function managedAllowlist(entries, { marketplaces = [], ...bar } = {}) {
  const ids = allowedSkills(entries, bar);
  return {
    strictKnownMarketplaces: marketplaces,
    permissions: { allow: ids.map((id) => `Skill(${id})`) },
  };
}
