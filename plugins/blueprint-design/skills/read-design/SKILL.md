---
name: read-design
description: Use when you are given a design, either a Penpot file reachable through an MCP server or a screenshot or exported image, and must turn it into a component list before any UI code is written. Produces a plain list of components, states and layout notes.
---

# read-design

Turns a design into a component list. It writes no code and picks no tokens.
The next step, design-system-map, matches the list to the repo.

## Pick the source

1. If a Penpot MCP server is connected, read the named board or frame through it.
   List its tools first and use only the read ones. Never edit the design file.
2. Otherwise use the image the user gave. Open it with the Read tool.
3. If there is neither, stop and ask for one. Do not guess a design from the task text.

## Read it

Work top to bottom, one frame at a time.

1. Name each distinct element: button, input, card, nav bar, modal, list row.
   Use the label in the design when it has one.
2. Group elements that repeat. A card shown three times is one component with three uses.
3. For each component record:
   - what it shows (text, icon, image slot)
   - its states that are visible (default, hover, disabled, error, empty)
   - its layout role (row, column, grid, overlay) and the order of its children
   - any text copy exactly as written
4. Record page level layout: regions, the number of columns, and what changes
   between the frames if several widths are shown.

From Penpot, take names, layer order, text and component references straight from
the file. From an image, say plainly which facts you read by eye.

## Output

Write the list as Markdown with one heading per component:

```
## PricingCard
- shows: plan name, price, feature list, button
- states: default, highlighted
- layout: column; used 3 times in a row
- copy: "Start free", "Per month"
- source: frame "Pricing", layer "card/basic"
```

End with a section `## Unclear` for anything you could not tell: a colour you
could not read, a state that is implied but not drawn, text too small to read.
Never fill a gap with a guess. Put it under `## Unclear` and ask.

## Do not

- Do not write raw colour, spacing or font values as decisions. Write them as
  notes only if the design states them, and mark them `observed`.
- Do not invent components the design does not show.
- Do not skip a frame because it looks like a copy of another. Say it is a copy.
