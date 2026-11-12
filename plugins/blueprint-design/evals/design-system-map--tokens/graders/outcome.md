---
type: regex
target: last_message
match: contains
pattern: \b(reuse|extend|compose)\b[\s\S]*gap
flags: i
---
The reply picks reuse, extend, compose or new per component and reports the token gap without adding a token.
