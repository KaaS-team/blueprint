.PHONY: check test check-mutations
check:
	node scripts/check-structure.mjs
	node scripts/check-prose.mjs
	node scripts/check-links.mjs
	node --test tests/*.test.mjs
test: check
check-mutations:
	node scripts/check-mutations.mjs
