---
name: build-on-design-system
description: Use when you must build a new UI component or page in a repo that has a design system. Finds the existing tokens and components first, builds from them, and lists every place you had to go outside them.
---

# build-on-design-system

Builds UI from what the repo already has, so new screens look like old ones.

## Steps

1. Find the design system: a tokens file, a theme, a component folder or a
   Storybook. If the repo has a `design-system-map` output, read that first.
   If there is no design system, say so and stop.
2. Read the design for the thing you are building. Name each part it needs.
3. For each part, look for an existing component. Use it as it is. If it nearly
   fits, use its props or variants before you write a new one.
4. Take colours, spacing, type sizes and radii from tokens. Do not write raw
   values such as `#3366ff` or `13px` in component code.
5. Build the page or component. Keep new components small and put them where
   the repo keeps the others.
6. List each exception: a part with no matching component, or a value with no
   token. Say what you did instead and why.

## Report

Say which existing components and tokens you used, then the exceptions list.
Run the repo's gate and quote its last line.

## Do not

- Do not copy an existing component to change one line. Add a variant.
- Do not add a token without saying so in the exceptions list.
