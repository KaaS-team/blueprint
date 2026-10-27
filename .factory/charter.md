# KaaS-team/blueprint factory charter


## Stack

`factory init` read this repo as **a Markdown and Node-script repo**.

## Risk tiers

- **low**: docs, one skill's text, or one check script with its test.
- **medium**: a new skill, agent, hook or rule, or a change to the installer.
- **high**: the marketplace manifest, release workflow or vendored upstream pins.

## Protected paths

A plan that requires editing any of these is refused at triage and needs a
human PR. Keep this list identical to `protectedPaths` in `config.json`.

- `.factory/**`
- `.claude/**`
- `.agents/**`
- `.github/**`
- `plugins/*/hooks/**` hook scripts are graded by their own case files, never by the agent that edits them

## STOP_IF

When `maxOpenFactoryPrs` factory PRs are already open, no new
`factory:ready` issue is picked up. Existing runs, approvals, answers and
revises keep going.
