.PHONY: check test check-mutations vendor
CHECKS := $(filter-out scripts/check-mutations.mjs,$(sort $(wildcard scripts/check-*.mjs)))
check:
	test -d node_modules || npm ci --ignore-scripts --no-audit --no-fund
	for c in $(CHECKS); do node $$c || exit 1; done
	node --test tests/*.test.mjs
test:
ifeq ($(strip $(FILES)),)
	$(MAKE) check
else
	node --test $(FILES)
endif
check-mutations:
	node scripts/check-mutations.mjs
vendor:
	node scripts/sync-upstream.mjs
