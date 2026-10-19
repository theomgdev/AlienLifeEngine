# Changelog

Versions before 0.1.0 belong to [The Life Engine](https://github.com/MaxRobinsonTheGreat/LifeEngine),
which this engine forked from and whose changelog lives in that repository.

## 0.1.0 (unreleased)

The fork, and everything that made it a different engine.

### The brain

- Every sighted organism carries an NxN Elman recurrent network with separate
  input and readout matrices, inherited and mutated, never trained
- RMSNorm every timestep with an inheritable gain, so unbounded weight mutation
  cannot saturate the network into a constant
- Half of each state vector is shared through a spatial CollectiveField, so
  nearby minds share state while keeping private weights
- A twelfth sensory channel carries white noise, making exploration an evolvable
  trait rather than an engine exception
- Brain geometry validated in one gate (`clampBrainShape`), with a live readout
  of the resolved shape

### The body

- The mover cell is gone: movement comes from having an eye, so mobility and
  thought cannot evolve apart
- Halt, reverse and two body turns added to the action space; turning costs the
  tick, which puts eye orientation under selection
- Movement is fully deterministic — no stuck-fallback, no random jolt. Birth
  orientation stays random, because for a rooted producer it is the only spatial
  exploration there is
- Self-occluded eyes report a mild percept instead of silence

### History and identity

- Seeded PRNG throughout, so a world can be replayed
- Species carry pronounceable taxonomic names generated from their anatomy
  rather than base-36 hashes
- Phylogeny keyed by id, bounded by reachability, so lineage chains survive
  their ancestors' extinction
- The Chronicle narrates the world as it runs; extinct species are recorded
  rather than dropped
- MindViewer renders a live organism's mind in the editor

### Interface

- Glassmorphic HUD, floating dock and responsive studio drawer, built for large
  screens and usable on a phone
- Control labels name what a setting does to the world, not the variable behind
  it
- Community panel carries lineage, project links and similar projects

### Defaults, tuned from play

- Founder mutability and the global fixed rate at 15%
- No sight subsidy, no free food drop: the food chain runs through producers
- Collective share at 0.5, where a herd signal emerges over autonomous movement
- Worlds start from a single static ancestor; the diverse random crowd is an
  option
