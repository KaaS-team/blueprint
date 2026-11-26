---
name: release
description: Use when a version of this package is ready to be released. Checks the version, changelog and gate agree, then prepares the release commit and the tag command. Never pushes a tag without a person saying so.
---

# release

Prepares a release so the tag workflow can publish it. It does not publish.

## Steps

1. **Version.** Read the version in `package.json`. Check it is higher than the latest git tag and follows semver.
2. **Changelog.** Check `CHANGELOG.md` has a section for exactly that version with a date. If it is missing, write it from the commits since the last tag. Each line says what changed for a user.
3. **Pins.** Check every catalogue entry names a tag or a full commit sha. `@HEAD` is never allowed.
4. **Gate.** Run the repo gate and `npm pack --dry-run`. Quote the last lines of both. Stop if either fails.
5. **Tag command.** Print `git tag v<version>` and `git push origin v<version>`. Do not run them. A person runs them after the release commit has merged.

## Ground rules

- Never move or delete an existing tag.
- Never publish to a registry by hand. The release workflow does that.
- Quote real command output. Do not paraphrase it.
