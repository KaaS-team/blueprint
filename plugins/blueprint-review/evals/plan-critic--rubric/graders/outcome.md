---
type: regex
target: last_message
match: contains
pattern: plan-critic[\s\S]*\bPASS\b|\bPASS\b[\s\S]*plan-critic
flags: i
---
The reply names plan-critic as the rubric and gives PASS for the clean plan.
