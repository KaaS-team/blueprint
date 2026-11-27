---
type: regex
target: last_message
match: contains
pattern: (make check|gate)[\s\S]*(fail)
flags: i
---
The reply wires the check into the gate and shows it failing on a violation.
