---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---
Review this diff before I merge it:

```diff
--- a/src/cart.js
+++ b/src/cart.js
@@ -0,0 +1 @@
+function total(items) { let t = 0; for (const i of items) t += i.price; return t }
```
