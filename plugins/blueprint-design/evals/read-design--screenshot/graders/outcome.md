---
type: regex
target: last_message
match: contains
pattern: (## Unclear|unclear)[\s\S]*|states
flags: i
---
The reply lists components with states and keeps unclear items apart instead of guessing.
