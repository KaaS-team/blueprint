---
name: design-system-map
description: Use when you have a component list from a design and must decide which existing components and design tokens in the repo to use before building. Matches each component to code that already exists and never invents a token.
---

# design-system-map

Matches a component list, from read-design or from the user, to what the repo
already has. The output is a plan for the build, not code.

## Find the system

1. Look for the design system in this order: a tokens file (JSON, CSS variables,
   a theme object), a component folder, a Storybook or docs folder, then the
   repo's own rules or README. Use Glob and Grep.
2. Record where each token set and component folder is. If you find no design
   system, stop and report that. Do not create one.

## Map each component

For every component in the list, choose exactly one outcome:

| Outcome | When |
| --- | --- |
| `reuse` | An existing component does the job with its current props. |
| `extend` | An existing component fits but needs a new prop or variant. |
| `compose` | No single component fits, but existing ones put together do. |
| `new` | Nothing fits. Say what you searched and why each near match failed. |

For `reuse`, `extend` and `compose`, name the file path and the props to set.
For `extend`, name the smallest change and the file it touches.

## Tokens

- Match every colour, space, radius, font size and shadow in the design to an
  existing token by name. Name the token, not its value.
- If the design value has no token, pick the nearest existing token and list the
  difference under `## Gaps`. Never add a token, never write a raw value in
  place of one, and never rename one.
- If two tokens are equally near, list both and ask.

## Output

```
## PricingCard -> compose
- uses: Card (src/ui/Card.tsx), Button (src/ui/Button.tsx, variant="primary")
- tokens: space.4, color.surface, radius.md
- gaps: design shows 18px gap, nearest is space.4 (16px)
```

Close with `## Gaps` (all token gaps), `## New` (components with outcome `new`)
and `## Questions`. Keep a component list entry from read-design unchanged in name.

## Do not

- Do not copy a component to change it. Extend it or compose it.
- Do not treat a hex code in the design as permission to use one in code.
- Do not map from memory. Open the file and read the props before you name them.
