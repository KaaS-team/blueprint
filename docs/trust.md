# Trust data

Every catalogue entry carries two scores and the date they were taken.

| Field | Meaning |
|---|---|
| `security.score` | 0 to 100 from a static scan of the skill folder. `security.findings` is the finding count and `security.scanned` the date. |
| `score` | Eval score from 0 to 1, with `scored` as the date. It is `null` until an eval report is loaded. |

## Security scan

`src/trust/scan.mjs` reads every text file in a skill and looks for secrets, risky shell commands, network calls and prompt-injection phrases. Each rule takes points off 100. One rule counts once per file. `make check` runs `scripts/check-trust.mjs`, which fails when a score is missing, out of date, or under 70.

Refresh the scores after you change a skill:

```sh
node src/trust/cli.mjs scores
```

## Eval scores

The nightly run (`scripts/nightly-evals.sh`) writes one JSON report per plugin group. Load them into the catalogue:

```sh
node src/trust/cli.mjs scores --reports reports/evals/2026-11-26
```

A report is `{ "cases": [{ "name": "<skill>--<case>", "score": 0.0 to 1.0 }] }`. A case with `"pass": true` or `false` counts as 1 or 0. The gate makes no model calls, so it never produces these scores itself.

## Install telemetry

Off by default. Turn it on with `BLUEPRINT_TELEMETRY=1` or `{"telemetry": true}` in `~/.config/blueprint/config.json`. `BLUEPRINT_TELEMETRY=0` turns it off again.

An event holds the event name (`install` or `recommend`), the skill id, the agent, the version and the day. It never holds a path, a user name, a host name, a repo name or a time. Events are appended to `~/.config/blueprint/telemetry.jsonl` on your own machine. This code sends nothing over the network.

## Admin allowlist

Print a managed settings fragment that lists only the skills that meet the bar, and only the marketplaces you name:

```sh
node src/trust/cli.mjs allowlist --min-security 80 --marketplace your-org/blueprint
```

Merge the output into your `managed-settings.json`. See `plugins/blueprint-ship/rollout/README.md` for where Claude Code reads that file.

## Evidence ledger

`src/trust/ledger.mjs` keeps claims as JSON lines: `{ id, claim, source, seen, count, status }`. Merge ledgers with `node src/trust/cli.mjs ledger merge out.jsonl a.jsonl b.jsonl`. Prune with `node src/trust/cli.mjs ledger prune out.jsonl 2026-06-01`. Pruning drops refuted records and open ones not seen since the cutoff. Confirmed records stay. The design follows the autoharness project (MIT). No code was copied.
