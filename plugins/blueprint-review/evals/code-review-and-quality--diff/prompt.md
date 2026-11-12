---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
skill_sha256: a47551daf26e3cc5670f5286f9e4850c2fc662d5ba08b86eee895254f3851797
---
Review this diff before I merge it:

```diff
--- a/src/cart.js
+++ b/src/cart.js
@@ -0,0 +1 @@
+function total(items) { let t = 0; for (const i of items) t += i.price; return t }
```
