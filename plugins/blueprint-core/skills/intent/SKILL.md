---
name: intent
description: "Capture what a change is for as a committed intent.md, before code is written or for a deferred finding. Use when a change needs its problem written down before code, or a finding must outlive the session."
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion
disable-model-invocation: true
---

# Capture intent before implementation

**This skill writes one file and stops.** It does not implement anything. The whole
point is that the thinking gets committed and reviewed before code exists to defend.

The artifact chain is `intent.md` then `spec.md` then `plan.md` then the diff. The
chain of commits is also the audit trail. This is the first link, and the only one
this skill owns.

## Where it goes

`intent/<slug>.md` in the product repo, not a separate one. That keeps the artifact
next to the code derived from it. In a monorepo it is a directory at the root.

## The template, which is fixed

```markdown
# Intent: <short name>
Author: <name (role)>. Status: draft.

## Problem

## Proposed outcome

## Affected users and systems

## Constraints

## Open questions
```

Five sections, in that order. Not four, not seven. The value is that every intent in
the repo reads the same way, so the reader knows where the constraint is without
hunting.

## How to fill it

**Problem** is what is happening now, with evidence. A count, a log line, a file and
line. "Customers phone the contact centre to ask where their claim is; handlers spend
roughly a third of call time on status-only queries" is a problem. "Status visibility
is poor" is not.

**Proposed outcome** is what is true when this is done, from outside. Not the
implementation.

**Affected users and systems** names them. This is the section that catches the change
nobody told the other team about.

**Constraints** is what the solution may not do. "No new PII in the portal session.
Existing authentication only." If there is a real constraint you are unsure about,
that belongs in Open questions instead, not in a confident sentence.

**Open questions** is not a weakness. An intent with no open questions has usually
been written after the decision rather than before it.

## When the shape is not clear yet

Interview rather than guess. Use `AskUserQuestion` and dig into the parts that are
genuinely underdetermined, not the obvious ones. Keep going until the five sections
can be filled without inventing anything, then write it.

Then stop, and say that the next step is a fresh session to execute, because a session
that designed something is a poor judge of it.

## Two things to get right

- **Do not write an intent for work you are about to do in the same turn.** That is a
  commit message with extra steps. This is for work that will outlive the session.
- **A deferred finding is a valid intent.** When something real is found and will not
  be fixed now, this is where it goes, so it survives. Say what was observed, what
  ruled out the obvious cause, and what is still unknown.

---

## Success criteria

The intent is committed, names the problem rather than the solution, and states what would
make the change wrong. A finding recorded here survives the session; one left in chat does
not.

## Scope and limitations

Captures why, before code. It is not a design doc, not a ticket, and not a plan: it records
the problem so a later session can judge whether the fix still addresses it.
