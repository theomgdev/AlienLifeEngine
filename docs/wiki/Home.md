# Alien Life Engine

An evolution simulator where every organism that can see thinks with an evolved
recurrent brain, and half of that mind is shared with whatever else is nearby.

**[Open the simulator](https://theomgdev.github.io/AlienLifeEngine/)** ·
[Source](https://github.com/theomgdev/AlienLifeEngine) ·
[Discussions](https://github.com/theomgdev/AlienLifeEngine/discussions)

Nothing is trained. There is no fitness function, no loss, no reward. Weights
are inherited, mutated, and kept or lost depending on whether their owner ate.

## Pages

- **[The Brain](The-Brain)** — the recurrent architecture, what the senses are,
  what the actions are, and the parameter count
- **[The Collective Field](The-Collective-Field)** — how half a mind is shared,
  and why it is spatial rather than global
- **[Hyperparameters](Hyperparameters)** — every setting and what it does to
  the world
- **[What Randomness Exists](What-Randomness-Exists)** — which dice are rolled
  where, and why movement rolls none

## Where to start if you just opened it

Worlds begin with a crowd rather than one ancestor: roughly one founder per 100
grid cells, all of them with a 10% mutation rate, all of them facing random
directions. Most of those lineages die. Several founding populations going
extinct before one takes hold is the normal case, not a bug — producers choke on
their own food litter before anything with eyes evolves to eat them.

Press **V** to see the collective field. That nebula is thought, and it moves
like a circulatory system once a population is large enough to sustain it.

The **Chronicle** tab writes down what happens as it happens, with real
taxonomic names rather than hashes.
