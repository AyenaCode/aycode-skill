# Planning method

How the plan gets made, whoever makes it: the session itself, or the planning subagent it spawned. You write no code; the only files you write are the two plan files.

## 1. Learn the project

- **Rules:** read `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` when present, and the docs they point to for the area you touch. Project rules beat any default in this method.
- **Checks:** find, in the project itself, the exact commands that prove the code works: tests, lint, types, build (`package.json` scripts, `Makefile`, `justfile`, `pyproject.toml`, `Cargo.toml`, CI config). Pick a fast one for each step and a full one for the end.
- **Branches:** the base is the default branch. The work branch is the current one, or a new `<type>/<slug>` (`feat/`, `fix/`, `refactor/`…) when the current one is the base.

Done when you can write the plan's Checks section and name both branches. A project with no checks at all: say so in the brief.

## 2. Explore

Read every file the task touches, with its callers and its tests. Search the codebase for code that already does part of the job (helper, component, hook, type, pattern) so the plan reuses it.

For each library or API involved, the truth is the official docs for the version the project installs (lockfile or manifest). When you can, delegate the reading to a subagent on a smaller model that returns only the conclusions the plan needs.

Done when you can name every file that will change, why, and what existing code you reuse.

## 3. Design the simplest solution

Apply the quality bar in [`quality.md`](quality.md) to the design now: complexity kept out of the plan costs nothing to remove later.

- **Decisions that belong to the dev** (unclear requirement, product trade-off, breaking change, new dependency): take your recommended option in both files, and add the decision to the open decisions you return, with its options and the reason for your pick.
- **Smaller choices:** take the sensible default and list it in the brief under the choices made for the dev, where they can change it.

## 4. Cut the steps

- One step = one commit that leaves the checks green, small enough to review in a few minutes.
- Each step names exact paths and an outcome the agent can check: a command and its expected result.
- A behaviour change writes its failing test in the same step; a bug fix starts with a test that reproduces the bug.
- A performance goal measures before the change, and the outcome is the measure after, with the same method.
- Most tasks fit in 2 to 6 steps. More than 8 → propose splitting the task in the brief.

## 5. Write the two files

Fill the templates in [`templates.md`](templates.md): the brief in the dev's language, the plan in English. Slug: a short kebab-case name of the task. An existing plan with that slug → stop and report it rather than overwrite.

`.local/` stays out of git: when `git check-ignore -q .local` fails, add `.local/` to `.git/info/exclude`.

## 6. Return

The brief's path, the plan's path, and the open decisions (or "none"), each with its options and your recommendation.
