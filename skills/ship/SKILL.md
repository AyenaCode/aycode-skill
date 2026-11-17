---
name: ship
description: Take a code task end to end — plan it with the dev, then loop through the steps (code, check, commit), simplify the whole change, verify it independently and report in the dev's language. Use when asked to "ship", to build, implement or fix something end to end, or to resume a `.local/plans/*.plan.md`.
argument-hint: [the task, or a .local/plans/*.plan.md to resume]
---

# Ship

Input: `$ARGUMENTS`, a task or a plan path. Empty → the `.local/plans/*.plan.md` whose Status is not all ticked (several → ask the dev which); none → ask for the task and stop.

The plan is your memory and the brief is the dev's voice. After the dev's go, you work through to the report without asking again, except when a step proves wrong.

The quality bar for every step, for the simplify pass and for the verifier: [`../planner/references/quality.md`](../planner/references/quality.md).

## 1. Plan and get the go

- **A task:** invoke the `planner` skill (`aycode:planner` in the Claude Code plugin) with it. It ends by asking the dev for the go; on the go, continue here with the plan it wrote.
- **A plan path:** read the plan and its brief. You are resuming: continue at the first unticked Status box.

Then set up the work:

- Check out the plan's branch, creating it from the base when it does not exist yet. Commits stay local: pushing is the dev's call.
- Uncommitted changes that are not yours → ask the dev before touching anything.

## 2. Loop over the steps

For each unticked step, in order:

1. **Sync.** Re-read the brief. Changed since you last read it → update the plan to match, log the change under Deviations, tell the dev in one line.
2. **Build.** Implement the step. Needed but unplanned → do it and log it under Deviations. The step proves wrong → stop, tell the dev why, and propose the fix to the plan.
3. **Check.** Run the step's outcome command and the fast checks. Red → fix the cause until green.
4. **Review.** Read the step's diff against the quality bar and fix what falls short.
5. **Commit.** Stage only this step's files and commit with the project's message convention. Tick the step in the plan and in the brief.

Done when every step is ticked and committed. After a context reset, re-read the plan and the brief and continue at the first unticked box. When the session must end first, tell the dev to run `ship` on the plan path to resume.

## 3. Simplify the whole change

Read the full diff from the base (`git diff <base>...HEAD`) with fresh eyes, against the quality bar. The steps were reviewed one by one; look for what only shows across them: duplication between files, reuse missed, code left dead, an abstraction with one use, logic in the wrong layer, work done twice. Search the codebase for existing code the new code repeats.

Apply the fixes, run the fast checks, commit as `refactor: simplify <slug>` when something changed, and tick "Simplify pass".

## 4. Verify

1. Run the full checks. Green → tick "Full checks green".
2. Spawn the `aycode:verifier` agent (outside the plugin: a fresh general-purpose subagent) with exactly this prompt, and nothing about your own work, so it judges the code rather than your account of it:

   > Read `${CLAUDE_SKILL_DIR}/references/verifier.md` and follow it. Plan: `<plan path>`. Base: `<base>`. Full checks: `<command>` → <passed or failed> at commit `<hash>`.

3. Append its result, dated, under the plan's Verdicts.
4. INCOMPLETE → fix every unmet item, rerun the full checks, verify again. A second INCOMPLETE → stop and report the blockers to the dev.

Done when the verifier prints `VERDICT: COMPLETE`. Tick it, and the brief's final box.

## 5. Report

Write the report in the dev's language, append it to the brief under a Report heading, and print it. About 15 lines, plain words:

- **What changed and why**, so the dev can explain it to a colleague.
- **Commits:** short hash and one line each.
- **Decisions and deviations** from the brief, each with its reason.
- **How to try it:** what to run or click, and what to expect.
- **What is left:** risks, follow-ups, or "nothing".
