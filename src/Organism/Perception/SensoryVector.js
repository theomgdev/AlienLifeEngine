// SensoryVector — gathers what an organism can actually perceive into a normalised
// vector for NeuralBrain.
//
// The old Brain received only the cell TYPE of the single nearest observation.
// Distance was computed and then thrown away, so a target 1 cell away and one 20
// cells away produced identical behaviour, and extra eyes were worthless because
// only the closest observation ever won. Here every eye contributes its own
// channels and the body's internal state is perceivable too.
//
// Channel layout (default 11 channels, fits inside private_n = 12 at N=16):
//   0..3   per-eye threat/food valence   (what the eye sees, signed)
//   4..7   per-eye proximity             (1 = touching, 0 = nothing in range)
//   8      hunger        food_collected / foodNeeded()   -> 0..1
//   9      integrity     1 - damage / maxHealth()        -> 0..1
//   10     age           lifetime / lifespan()           -> 0..1
//
// Valence is a hand-set prior on cell types, NOT a decision: it tells the brain
// *what* is there in one number, and the evolved weights decide what to do about it.
// Sign carries the obvious physics (killer hurts, food feeds); everything else is
// near zero so evolution is free to assign meaning.
//
// One exception is load-bearing: when seeThroughSelf is off, an eye staring into
// its own body reports a mild negative instead of nothing, so an occluded eye is
// a perceivable handicap and body geometry comes under selection.

const CellStates = require('../Cell/CellStates');
const Hyperparams = require('../../Hyperparameters');

const MAX_EYES = 4;
const CHANNELS = 11;

// cell type -> valence prior
const VALENCE = {
    empty: 0.0,
    food: 1.0,
    wall: -0.3,
    mouth: -0.2,
    producer: 0.4,
    killer: -1.0,
    armor: -0.15,
    eye: -0.1,
};

// Your own body blocking your own eye, when seeThroughSelf is off. It is not a
// threat, it is a wasted eye: mildly negative so evolution feels a reason to
// keep sightlines clear and shape a better body geometry, but far weaker than a
// killer so a self-occluded eye is a handicap rather than a death sentence.
const SELF_OCCLUSION_VALENCE = -0.25;

const SensoryVector = {
    CHANNELS,
    MAX_EYES,

    _buf: new Float32Array(CHANNELS),

    /**
     * Build the sensory vector for an organism.
     * @param {Organism} org
     * @param {Array<Observation>} observations  this tick's eye reports
     * @returns {Float32Array} length CHANNELS, values roughly in [-1, 1]
     */
    build(org, observations) {
        const v = this._buf;
        v.fill(0);

        const range = Hyperparams.lookRange || 20;
        const n = Math.min(observations.length, MAX_EYES);
        for (let i = 0; i < n; i++) {
            const obs = observations[i];
            if (!obs || !obs.cell) continue;

            const proximity = Math.max(0, 1 - obs.distance / range);

            if (obs.cell.owner === org) {
                // Own body in the sightline. With seeThroughSelf on, the ray
                // already skipped past it, so reaching here at all means the
                // switch is off and this eye is genuinely occluded. Report that
                // as a real percept instead of silence: reporting zero made
                // blindness indistinguishable from open space, so evolution got
                // no signal at all and self-blinding eyes drifted in for free.
                if (!Hyperparams.seeThroughSelf) {
                    v[i] = SELF_OCCLUSION_VALENCE;
                    v[MAX_EYES + i] = proximity;
                }
                continue;
            }

            const name = obs.cell.state ? obs.cell.state.name : 'empty';
            const valence = VALENCE[name] !== undefined ? VALENCE[name] : 0;

            v[i] = valence;
            v[MAX_EYES + i] = proximity;
        }

        // internal state — an organism that cannot feel its own hunger cannot
        // trade off foraging against fleeing
        const needed = org.foodNeeded();
        v[8] = needed > 0 ? Math.min(1, org.food_collected / needed) : 0;
        const maxHp = org.maxHealth();
        v[9] = maxHp > 0 ? Math.max(0, 1 - org.damage / maxHp) : 0;
        const span = org.lifespan();
        v[10] = span > 0 ? Math.min(1, org.lifetime / span) : 0;

        return v;
    },
};

module.exports = SensoryVector;
