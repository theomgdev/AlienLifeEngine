# What Randomness Exists

The engine is deliberately split: some dice are load-bearing and some were
removed. Knowing which is which keeps a well-meant cleanup from sterilising a
world.

## Where dice are rolled

**Birth orientation.** A child faces a random direction, gated by
`rotationEnabled`. For a rooted producer this is the *only* spatial exploration
available — it cannot move, so the direction it faces is the only thing that
varies between its offspring. Remove it and a lineage becomes a single
orientation forever.

**Mutation.** Which cell changes, what it becomes, whether the rate itself
drifts up or down, and every per-weight perturbation of the brain.

**Sense channel 11.** Fresh noise every tick, fed to the brain as an input. This
is the one place a creature can get randomness *into its decisions*, and only if
evolution wires `Win` to that channel. It is an opportunity, not an imposition.

**World generation.** Founder placement and founder bodies, when a world starts
with the diverse random crowd. The default single ancestor is deterministic: a
fixed body at the centre of the grid.

## Where no dice are rolled

**Movement.** A creature decides, and the decision stands. If the move is
blocked it simply fails; nothing jolts the creature to a random heading, and
there is no timer that overrides a deliberate hold.

Measured on 10,000 decisions: zero RNG draws inside the movement path, and two
runs from the same state produce bit-identical trajectories.

## Why movement has no safety net

The engine previously rescued stuck organisms: on a blocked move or a
`move_range` timeout it would rotate them randomly. That fired on 33.3% of all
decisions — a third of every creature's behaviour was dice rather than brain,
and the network never experienced the consequence of walking into a wall, only
a random jump.

That rescue made sense for a stateless lookup-table brain, which could lock
onto an obstacle forever with no way to represent "I tried this already." A
recurrent network has memory, plus halt, reverse and two turn actions. Escaping
is its own job now, and a lineage whose brains cannot manage it is meant to die.

The practical consequence: early generations are more fragile than they were.
That is the selection pressure working, not a defect.

## Reproducibility

Movement is deterministic, but a whole world is not reproducible from a seed
today — the RNG is global and shared, so anything that changes the order or
number of draws (a birth, a death, a mutation) shifts the stream for everything
after it. Comparing two runs means fixing the seed *and* the sequence of events.
