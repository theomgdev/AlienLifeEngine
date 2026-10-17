# The Brain

Every organism carries one. It is only used once the body has an eye — sight is
what grants movement — but it is inherited unconditionally, so a lineage that
loses its eyes keeps the mind and can regain the use of it.

## Architecture

An Elman recurrent network with three separate weight matrices:

$$z = W h_t + W_{in} s_t + b$$
$$h_{t+1} = \tanh(\text{RMSNorm}(z) \cdot \gamma)$$
$$a = W_{out} h_{t+1}$$

where $s_t$ is the sense vector, $h$ the hidden state, and $a$ the action
logits. The separation matters: senses do not overwrite memory, and actions do
not occupy memory slots. Every one of the $N$ state channels is pure recurrent
state.

`RMSNorm` with an inheritable gain $\gamma$ is what keeps a brain functional
under unbounded mutation. Without it a recurrent loop either saturates to $\pm 1$
or decays to nothing within a few generations of weight drift.

## Senses (12 channels)

| Channel | Meaning | Range |
|---|---|---|
| 0–3 | per-eye valence — what that eye sees, signed | −1…1 |
| 4–7 | per-eye proximity — 1 is touching, 0 is nothing in range | 0…1 |
| 8 | hunger — food collected over food needed | 0…1 |
| 9 | integrity — 1 minus damage over max health | 0…1 |
| 10 | age — lifetime over lifespan | 0…1 |
| 11 | random drive — fresh noise every tick | −1…1 |

Four eyes is the cap. A fifth eye still costs food and still occupies a cell,
but its report never reaches the brain — evolution pays for it and gets nothing,
which is the intended pressure.

Valence is a hand-set prior on cell types, not a decision. It says *what* is
there in one signed number; the evolved weights decide what to do about it.
Killer cells read negative and food reads positive because that is physics, and
everything else sits near zero so evolution can assign its own meaning.

Channel 11 is the one input with no external cause. If `Win` evolves a
connection to it, the creature can wander spontaneously, break a deadlock, or
randomise a patrol; if those weights go to zero, it is deterministic again.

## Actions (9 channels)

| Index | Action |
|---|---|
| 0–3 | move up, down, right, left |
| 4 | `HOLD` — keep the current heading and step |
| 5 | `HALT` — stay put, conserve the move |
| 6 | `REVERSE` — step backwards without turning the body |
| 7 | `TURN_L` — rotate the body and eyes 90° left |
| 8 | `TURN_R` — rotate the body and eyes 90° right |

The highest logit wins, provided it clears `brainActionThreshold`; below that
the creature holds its course.

Turning is separate from moving because an eye's direction is fixed relative to
the body. A creature that wants to look somewhere else must spend a move
rotating, and the rotation fails if the rotated body would not fit. Without
those two channels, organisms strafe — they change heading while staring the
same way forever, and eye placement stops being under selection.

## Parameter count

At $N = 16$, 12 senses and 9 actions:

| Matrix | Size | Parameters |
|---|---|---|
| $W$ | 16 × 16 | 256 |
| $W_{in}$ | 16 × 12 | 192 |
| $W_{out}$ | 9 × 16 | 144 |
| $b$ | 16 | 16 |
| $\gamma$ | 1 | 1 |
| | **total** | **609** |

Weights live in one `BrainArena` of typed arrays indexed by slot, not in
per-organism objects, which is what makes a few thousand brains per frame
affordable. Measured cost at $N = 16$ with 2000 organisms: about 1.5 ms per
tick, roughly 9% of a 60 fps frame.

## Limits

$N \in [4, 64]$. The floor is 4 rather than 1 because the shared fraction
claims at least one channel, and a brain with no private channel cannot hold a
thought between ticks. Everything that sets brain geometry — the UI, a loaded
world file, a fresh world — passes through `clampBrainShape`, and out-of-range
values are clamped with a notice rather than rejected.
