# Hyperparameters

Defaults as the engine ships them. Everything is live-editable in the
Hyperparameters tab, and the labels there describe what a setting does to the
world rather than what variable it writes.

## Ecology

| Setting | Default | What it does |
|---|---|---|
| `lifespanMultiplier` | 100 | Lifespan is cell count times this |
| `foodProdProb` | 5 | Chance per tick that a producer cell drops food in an adjacent empty cell |
| `sightedProducerRate` | 0 | A sighted body produces food at this fraction of a blind one's rate. At 0, having an eye switches photosynthesis off entirely, so thinkers must hunt |
| `foodDropProb` | 0 | Free food appearing from nowhere. Off: the food chain runs through producers |
| `sightedFoodCost` | 0 | Extra food a sighted organism must collect before reproducing |
| `foodBlocksReproduction` | true | Food cells block a birth |
| `instaKill` | false | One touch from a killer cell is fatal |
| `maxOrganisms` | −1 | Population cap; −1 is uncapped |

The first three are the ones that decide whether a world is hospitable. Sight
costs food production and buys movement; at `sightedProducerRate = 0` that
trade is absolute, and a sighted lineage either learns to graze on producer
colonies or dies.

## Mutation

| Setting | Default | What it does |
|---|---|---|
| `useGlobalMutability` | false | Use one fixed rate for everyone instead of inherited rates |
| `globalMutability` | 15 | That fixed rate, in percent |
| `addProb` / `changeProb` / `removeProb` | 33 / 33 / 33 | Relative weights for growing, changing and losing a cell |
| `rotationEnabled` | true | Bodies may rotate. Off: orientation is fixed for life and the turn actions always fail |

With `useGlobalMutability` off — the default — every organism carries its own
mutability, starting at 15% for founders and drifting ±1 on each birth with a
floor of 1. Lineages evolve how fast they evolve.

## Perception

| Setting | Default | What it does |
|---|---|---|
| `lookRange` | 20 | How far an eye sees, in grid cells |
| `seeThroughSelf` | true | Eyes see past their own body. Off: an own-body cell reads as a mild obstacle, so body geometry comes under selection |

## Brain

| Setting | Default | What it does |
|---|---|---|
| `brainN` | 16 | State vector length. Range 4–64 |
| `brainSharedFrac` | 0.5 | Fraction of state shared through the field. Range 0–0.9 |
| `brainInitScale` | 0.6 | Spread of initial random weights |
| `brainMutationSigma` | 0.08 | Standard deviation of per-weight mutation |
| `brainActionThreshold` | 0.15 | Below this the top logit is ignored and the creature holds course |

`brainActionThreshold` is worth knowing about if populations die too readily:
below it a creature holds its heading, which against a wall means continuing to
press into it. Lowering it lets the escape actions win more easily.

## Collective field

| Setting | Default | What it does |
|---|---|---|
| `collectiveTileSize` | 6 | Storage resolution, grid cells per tile |
| `collectiveRadius` | 20 | Influence disc radius in grid cells |
| `collectiveLeak` | 0.85 | Field memory; higher means slower-moving culture |

## World start

| Setting | Default | What it does |
|---|---|---|
| `randomStart` | false | Seed the world with a diverse random crowd instead of one ancestor |
| `maxStartPopulation` | 20000 | Cap on founders when the crowd is used |

Off, a world begins as the classic single static ancestor — mouth plus two
producers — and has to evolve movement and sight for itself. On, it begins with
roughly one founder per 100 grid cells, some of them already sighted and
thinking, so regional cultures form immediately.
