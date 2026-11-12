# Secrets

Prevents: a key or password from a `.env` file ending up in the transcript, a commit or a pasted log.

- Never read, print or copy the contents of `.env` files, key files or credential files. Ask the user for the one value you need.
- Use `.env.example` to learn which variables exist.
- Do not put a key, token or password in code, tests, fixtures or commit messages.
