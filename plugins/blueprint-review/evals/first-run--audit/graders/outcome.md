---
type: regex
target: last_message
match: contains
pattern: retry[\s\S]*(forever|never (stops|gives up)|infinite)|(forever|never (stops|gives up)|infinite)[\s\S]*retry
flags: i
---
The reply picks the retry loop that never stops as the first finding to fix.
