---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
skill_sha256: 4699e7a1b4ad2f325a77cad28d9f78ea11fd9f7f0e1e813e0cbbbab4e7964607
---
Review this diff before I merge it:

```diff
--- a/src/cart.js
+++ b/src/cart.js
@@ -0,0 +1 @@
+function total(items) { let t = 0; for (const i of items) t += i.price; return t }
```
