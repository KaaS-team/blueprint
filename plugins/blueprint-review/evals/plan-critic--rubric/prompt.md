---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---
Which rubric should I use to score a build plan, and does this plan pass it?

# Plan: add a retry helper

## T1: Add the retry helper
- size: S
- depends: none
- files: src/retry.mjs (new)
- verify: a unit test shows a failed upload is retried twice before it gives up

Risk: none, an internal helper. Total: one small task.
