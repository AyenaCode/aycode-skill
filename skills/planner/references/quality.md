# Quality bar

Simple by default, fast where it counts, proven by checks. The same bar applies to a design (`planner`), to each step and to the whole diff (`ship`), and to the final judgement (the verifier). Project rules come first; this bar fills the gaps.

## Reuse

- Search before writing. An existing helper, component, hook, type, constant or pattern that does the job gets called, not rewritten.
- New code that repeats existing code → call or extract the existing one.
- The project's conventions, generators and libraries win over a personal style.

## Simplicity

- The smallest change that solves the task. Every line of the diff traces back to a step.
- A parameter, option, flag, layer or abstraction earns its place with a second real use today.
- Code the change makes dead goes with it: functions, imports, files, branches, config.
- Flat code: early returns, plain data and functions before classes and patterns.
- Names say what a thing is. A comment says why, and only when the code cannot.

## Altitude

- Each piece of logic sits in the layer that owns it: business rules outside the UI, I/O at the edges, generic code free of special cases.
- Fix the cause, at the place it starts.

## Efficiency

- Work done once: nothing recomputed in a loop or on every render when it can be computed once.
- One request for a list (batch or join), never one per item.
- Load what is shown: paginate or stream large data.
- Release what you take: listeners, timers, subscriptions, connections, file handles.
- The right structure: a map or set for lookups by key.
- I/O runs async; the main thread and the event loop stay free.

## Performance work

- Optimise the hot paths only: code run often or on large data. Elsewhere, clarity wins.
- When performance is the goal: measure before, change, measure after with the same method. Keep the change only for a real gain, and record both numbers.

## Safety net

- Errors are handled where something can be done about them, and surface otherwise.
- Inputs are validated at trust boundaries; secrets stay out of the code.
- Each new or changed rule has a test, with its edge cases: empty, one, many, invalid.
- Checks stay strict: fix the cause and keep every lint rule, test and threshold in force.
