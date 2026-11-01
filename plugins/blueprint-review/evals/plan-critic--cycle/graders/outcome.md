---
type: regex
target: last_message
match: contains
pattern: \b(REVISE|BLOCK)\b[\s\S]*cycl
flags: i
---
The verdict is REVISE or BLOCK and the reply names the dependency cycle.
