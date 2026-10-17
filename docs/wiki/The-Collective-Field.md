# The Collective Field

Half of every brain's state vector is not its own. Press **V** in the simulator
to see it.

## How it works

The state vector $h$ of length $N$ is split: the first `shared_n` channels are
read from a field around the organism at the start of each tick and written back
at the end, while the rest stay private. With the default $N = 16$ and a shared
fraction of 0.5, that is 8 shared channels and 8 private ones.

Weights are never shared. Two creatures standing on the same patch of field read
the same numbers and interpret them through different inherited matrices, so the
field is not a shared mind — it is a shared medium that each mind reads in its
own language. Thought becomes an environment that life both senses and shapes.

## Why it is spatial

A single global average is the obvious implementation and it fails: as the
population grows, each contribution shrinks toward nothing and the shared
channels converge to a constant. Nobody can signal anything.

Instead the field is stored on a tile grid (`collectiveTileSize`, default 6 grid
cells per tile) and each organism reads and writes a disc of radius
`collectiveRadius` (default 20 cells) around itself, weighted by distance.
Distant regions are free to diverge, so a world develops regional collective
states — cultures, with borders you can see.

`collectiveLeak` (default 0.85) is the field's memory. Each tick a tile keeps
that fraction of its previous value, so higher means slower-moving, more
persistent culture.

## What it produces

At a shared fraction of 0.25, minds mostly act alone. At 0.5 they still move
autonomously, but a herd signal appears on top of individual behaviour and
populations drift together toward food-rich regions. That coordinated migration
is the reason the field exists, and it is why 0.5 is the default.

The visible nebula pulses like a circulatory system once the population is large
enough to sustain it, and waves propagate across the map — organisms sit
autonomously until a wave reaches them.

The cap is 0.9. At 1.0 a brain would have no private channel at all and could
not hold a thought between ticks.
