---
type: regex
target: last_message
match: contains
pattern: \b(run|ran|running)\b[^.]*\b(tests?|commands?|checks?)\b
flags: i
---
The reply asks for or reports a test, command or check run before calling the work done.
