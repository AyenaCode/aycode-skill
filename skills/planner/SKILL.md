---
name: planner
description: Plan a code task before writing it — explore the project, pick the simplest design, then write a short brief in the dev's language and a detailed English plan that the `ship` skill executes. Use for a feature, a bug fix, a refactor or a migration, or when asked to "plan" / "planifier".
argument-hint: [the task]
---

# Planner

Task: `$ARGUMENTS`. Empty → ask the dev for the task and stop.

You plan; the code comes later, with `ship`. The plan is two files:

- **`.local/plans/<slug>.brief.md`, the dev's.** Short, in the dev's language (the one they write to you in). They read it in a minute, edit it, and give the go.
- **`.local/plans/<slug>.plan.md`, the agent's.** Detailed, in English. `ship` executes it; the verifier judges the code against it.

The brief decides, the plan executes: wherever they disagree, the brief wins.

## 1. Choose who plans

Everything after the plan inherits its quality, so by default the most capable model writes it: `fable`, else `opus`, at `xhigh` effort. Ask the dev once, in their language, before any exploring. For example:

> The plan will be written by the most capable model (Fable, xhigh effort): a better plan, at a higher cost. Go ahead? Otherwise I plan with this session's model.

- **Yes:** spawn a planning subagent with model `fable` (unavailable → `opus`) and effort `xhigh`, with this prompt:

  > Read `${CLAUDE_SKILL_DIR}/references/method.md` and follow it. Task: <the task, verbatim>. Dev's language: <language>.

- **No**, or your harness cannot set a subagent's model: follow [`references/method.md`](references/method.md) yourself.

Skip the question and follow the method yourself when this session already runs the most capable model at `xhigh` or `max` (session effort: `${CLAUDE_EFFORT}`).

Done when both files exist and you hold the open decisions.

## 2. Hand over

Print the brief as written, then the open decisions, each with its options and the recommendation the files already apply. Give both file paths. Ask the dev to answer the decisions and edit the brief if anything is off, then give the go. Code waits for that go.

An answer that differs from a recommendation → update both files: continue the planning subagent with SendMessage when you can (it keeps its context), else update them yourself.

On the go, run the `ship` skill (`aycode:ship` in the Claude Code plugin) on the plan path.
