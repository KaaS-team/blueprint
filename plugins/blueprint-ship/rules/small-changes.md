# Small changes

Prevents: one large change that no reviewer can read, with unrelated fixes hidden in it.

- One commit per concern, and each commit passes the gate on its own.
- Do not reformat, rename or tidy code the task does not need. Note it for later.
- Do not push to `main`, and do not rewrite history on a shared branch.
