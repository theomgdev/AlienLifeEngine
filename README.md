# Alien Life Engine

A world where every organism that can see thinks with an evolved neural brain —
and a quarter of that mind is not its own.

Nothing is taught here and nothing is trained. The weights are shaped by
selection alone.

## The hive mind

Every sighted organism carries an N×N fully connected recurrent network. Its
state vector is split in two:

- **three quarters private** — the creature's own memory, carried between ticks
- **one quarter shared** — read from and written back into a field around it,
  which every nearby mind also reads and writes

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

Worlds start as a crowd scaled to their area rather than a single ancestor:
roughly one founder per 100 grid cells, so many independent lineages exist from
tick one.

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
on a 10% side-branch, so the mind is always under selection.

### Eyes and brains

An eye has a direction, shown by the slit, and sees the first non-empty cell
within range. Every eye on a body reports, and all of those reports are fed to
the brain together, so more eyes genuinely means more perception. The brain's
output steers movement; its state carries between ticks, and a quarter of that
state is shared with every mind nearby.

## Credit

Built on [The Life Engine](https://github.com/MaxRobinsonTheGreat/EvolutionSimulatorV2)
by Max Robinson. GPL-3.0, as is this.
