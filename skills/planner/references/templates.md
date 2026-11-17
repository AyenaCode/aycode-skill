# Plan templates

## Brief: `.local/plans/<slug>.brief.md`

The dev's file. Write all of it in the dev's language, every heading and label translated, in plain words: no code, no jargon the dev did not use first. About 20 lines: one minute to read. Keep only what the dev must know: at most 5 choices, those that change what the code does; every other detail goes in the plan.

```markdown
# <Task title>

**Goal:** <one sentence: what the dev gets>
**Work:** branch `<branch>` from `<base>`, one commit per step, nothing pushed.

## What changes
- <one line each>

## What stays the same
- <the boundaries the dev may assume>

## Steps
- [ ] 1. <one line>
- [ ] 2. <one line>
- [ ] Final review: simplify, all checks, independent verification

## Choices made for you
- <default taken>: <why, in a few words>. Change it here if you disagree.

## How to try it
<1 to 3 lines: what to run or click, and what you should see>
```

`ship` ticks the boxes and appends a Report section at the end. It never rewrites the dev's choices.

## Plan: `.local/plans/<slug>.plan.md`

The agent's file, in English. Everything `ship` and the verifier need, and nothing the code or the brief already says.

```markdown
# <Title>
Brief: `.local/plans/<slug>.brief.md` · Base: `<base>` · Branch: `<branch>` · Created: <date>
Executed by the `ship` skill; the brief wins over this plan.

## Checks
- Fast (each step): `<command>`
- Full (end): `<command>`

## Context
- `<path>`: <why it matters>
- Reuse: <existing code the steps build on>
- Docs: <library@version: conclusion that shapes the code>
- Rules: <project rules in play>

## Steps
1. **<action>** — `<paths>` — outcome: `<command>` → <expected result>

## Status
- [ ] 1.
- [ ] Simplify pass
- [ ] Full checks green
- [ ] Verifier: COMPLETE

## Out of scope
## Deviations
## Verdicts
```
