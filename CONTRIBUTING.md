# Contributing

Issues and pull requests are welcome, including assisted ones. Everything below
is either a mechanic you need or a reason something gets closed; the working
rules for assistants live in [AGENTS.md](AGENTS.md), which is worth reading
whether or not you use one.

## Running it

```
npm install
npm run build        # or npm run build-watch while editing
npm start            # serves dist/ on http://localhost:8111
```

`dist/js/bundle.js` is gitignored and built from `src/`, so the browser shows
nothing new until you rebuild.

## Before you open a pull request

Run what CI runs, so a red check is not the first you hear of it:

```
npm run build
node .github/scripts/invariants.js
```

The invariants script loads the real modules and asserts the things that
silently ruin a world — every sense channel reaching the brain, brain geometry
being clamped, movement staying free of random fallbacks, and the diversity
rolls still being present. It prints one line per check and exits non-zero on
failure. There is no unit test suite beyond this.

If you changed anything you can see, say what you saw. A screenshot or a
population and species count beats "works fine".

## Assisted contributions

This project accepts LLM-assisted work and asks you to disclose it. Add a
trailer to a commit:

```
Assisted-by: <tool name>
```

or a line in the pull request body. A workflow asks for it if neither is
present. The trailer is disclosure, not credit — the author stays human, and so
does responsibility. Never add `Signed-off-by` on a model's behalf.

Two things get a contribution closed regardless of how it was written. The first
is not being able to explain it: if you could not answer why a line is there,
it is not ready. The second is answering review comments by feeding them back to
a model — if you do not follow an objection, say so and ask.

## What makes a change easy to accept

Keep the diff to what you set out to do. Unrelated reformatting, a refactor of
code you scrolled past, or a new abstraction over something that needed ten
lines all make a small change expensive to review.

This simulator has no fitness function and nothing is trained. A change that
"helps organisms learn" by scoring them, nudging them toward a goal, or
rescuing them from their own mistakes is a change of premise, not an
improvement — open a discussion first. Movement is deliberately deterministic
for the same reason: a creature that cannot escape an obstacle is supposed to
die of it.

New hyperparameters are a cost. One earns its place when someone would
genuinely flip it, not because two implementations happen to exist. Labels in
the UI describe what a setting does to the world, not what variable it writes.

## Reporting something strange

The engine does strange things on purpose, so a report needs enough to tell a
phenomenon from a bug: the hyperparameters you changed, roughly how many ticks
in, whether the population still had eyes, and what you expected instead. An
exported world is better than all of that.

Behaviour you find beautiful is also worth posting. [Discussions](https://github.com/theomgdev/AlienLifeEngine/discussions)
is the place for worlds, lineages and questions; issues are for defects.
