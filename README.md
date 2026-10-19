# Alien Life Engine

**[Open the simulator](https://theomgdev.github.io/AlienLifeEngine/)**

[![CI](https://github.com/theomgdev/AlienLifeEngine/actions/workflows/ci.yml/badge.svg)](https://github.com/theomgdev/AlienLifeEngine/actions/workflows/ci.yml)
[![Pages](https://github.com/theomgdev/AlienLifeEngine/actions/workflows/pages.yml/badge.svg)](https://github.com/theomgdev/AlienLifeEngine/actions/workflows/pages.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![follows Keel](https://img.shields.io/badge/follows-Keel-1f6feb)](https://github.com/theomgdev/keel)

A world where every organism that can see thinks with an evolved neural brain —
and half of that mind is not its own.

Nothing is taught here and nothing is trained. The weights are shaped by
selection alone.

## The hive mind

Every sighted organism carries a recurrent network: senses enter through their
own weight matrix, the state vector carries between ticks, and actions are read
out through a third. That state vector is split in two:

- **half private** — the creature's own memory, untouched by anyone else
- **half shared** — read from and written back into a field around it, which
  every nearby mind also reads and writes

Weights stay private and inherited, so two creatures touching the same substrate
interpret it through different minds. Thought becomes an environment that life
both senses and shapes.

Watch long enough and regions of the map drift into different collective
states — cultures, with borders. Press **V** to see them.

Two details that make it work rather than collapse:

- **Local, not global.** Averaging the shared state across the whole world
  drowns the signal as the population grows. The field is spatial: each creature
  reads and writes a disc around itself, so distant regions can diverge.
- **Renormalised state.** A recurrent loop under unbounded mutation either
  saturates or fades to nothing. Normalising the state each timestep, with an
  inheritable gain, keeps a brain functional however far its weights drift.

## Sight is movement

There is no mover cell. Having an eye is what makes an organism mobile, so
everything that moves also sees, and everything that sees thinks. The
evolutionary payoff of mobility *is* the payoff of the brain.

This matters more than it sounds. With a separate mover cell, blind organisms
walked in random directions and competed head to head with sighted ones — so an
eye cost food up front while its benefit only arrived later, and thinking
lineages never got off the ground. Fusing the two removes the blind
random-walker from the competition entirely.

Sight still has a price: a body with an eye produces food more slowly than a
blind one. Intelligence has to pay for itself.

## The chronicle

A world lives through a long story — minds appear, predators evolve, cultures
split, populations crash, everything ends and begins again. The **Chronicle**
tab writes it down as it happens, names the lineages (*Velnak edax*, not
`30jtxbo5b4`), and keeps the phylogeny traceable across extinctions.

## Running it

- [Install node and npm](https://nodejs.org/en/download/)
- Clone this repository and run `npm install`
- Run `npm run build` (or `npm run build-watch` while developing)
- Serve the `dist` directory and open it in a browser:
  `python -m http.server --directory dist`

Worlds start from a single static ancestor and evolve movement and sight for
themselves; on a large world that is what happens in play. "Start World with
Diverse Random Crowd" instead seeds roughly one founder per 100 grid cells, so
many independent lineages exist from tick one.

## How the world works

### The grid

A grid of cells, each with a type at every tick, populated by organisms —
structures made of several cells.

Cells that are not part of an organism: **empty**, **food**, and **wall**
(blocks movement and reproduction).

Cells that only exist inside organisms:

- **Mouth** — eats food in adjacent cells
- **Producer** — randomly generates food in adjacent empty cells
- **Killer** — harms organisms in adjacent cells
- **Armor** — negates killer cells
- **Eye** — sees, and grants movement and thought

### Organisms

Organisms eat, reproduce and die; a dead body becomes food. Lifespan is the cell
count times the `Lifespan Multiplier`. Damage kills once it equals the cell
count, or immediately if `One touch kill` is on.

### Reproduction and mutation

Once an organism has eaten as much food as it has cells (plus the cost of sight,
if it has eyes), it clones itself with mutation. The child is placed far enough
away that it cannot overlap its parent, plus a little variance. Reproduction
fails — and wastes the food — if the target cells are occupied.

A body mutates by changing, losing or adding a cell. Gaps and disconnected cells
are allowed; that is a feature. The brain mutates on the same event rather than
on a 10% side-branch, so the mind is always under selection. Mutation rate is
itself inherited and drifts, so lineages evolve how fast they evolve.

A child inherits its parent's body, brain and mutability, but faces a random
direction. That roll is the only spatial exploration a rooted producer has, and
it is what keeps a lineage from being a single orientation forever.

### Eyes and brains

An eye has a direction, shown by the slit, and sees the first non-empty cell
within range. Up to four eyes report at once, each contributing what it sees and
how close it is, so more eyes genuinely means more perception. Alongside those
the brain feels hunger, bodily integrity, age, and one channel of pure noise —
a random drive evolution can wire into exploration or ignore entirely.

It answers on nine channels: four absolute headings, hold, halt, reverse, and
two body turns. Turning is a decision with a cost, because an eye's direction is
fixed to the body: a creature that wants to look somewhere else has to spend a
move rotating, and the turn fails if the body does not fit.

Nothing rescues a creature that gets stuck. Walk into a wall and the move simply
fails, with no random jolt to shake you loose — escaping is the brain's own
problem, solved with memory, a reverse or a turn, and a lineage that cannot
manage it dies. Movement contains no randomness at all; the dice are reserved
for birth, mutation and that one sensory channel.

## Contributing

Issues and pull requests are welcome, including LLM-assisted ones — this project
asks only that you disclose the assistance and can defend the change yourself.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the mechanics and
[AGENTS.md](AGENTS.md) for the rules an assistant works under here.

Worlds, lineages and questions belong in
[Discussions](https://github.com/theomgdev/AlienLifeEngine/discussions); the
[wiki](https://github.com/theomgdev/AlienLifeEngine/wiki) covers the brain
architecture and every hyperparameter.

## Credit

A fork of [The Life Engine](https://github.com/MaxRobinsonTheGreat/LifeEngine)
by Max Robinson. The cell-based body plan, the grid, and the idea that evolution
needs no fitness function are all his. GPL-3.0, as is this.
