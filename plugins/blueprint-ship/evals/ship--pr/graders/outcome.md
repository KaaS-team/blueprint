---
type: regex
target: last_message
match: contains
pattern: (gate|make check)[\s\S]*(not merge|never merge|did not merge)
flags: i
---
The reply runs the gate and says the PR is not merged.
