// BrainShape — the single place that decides what brain geometry is legal.
//
// This exists because the UI used to hand raw input values straight to
// BrainArena. Nothing checked them, so a brain could be asked for that the
// engine cannot actually run: N=1 (zero private channels, no memory possible),
// a collective share that rounds down to zero channels while the user asked for
// some, or a share of 1.0 leaving nothing private at all. Three separate paths
// could set the shape — the control panel, loading a world, loading a preset —
// and each clamped differently or not at all.
//
// Every one of those paths now goes through clampBrainShape(), which returns
// both the usable shape and a list of what it had to change, so the caller can
// tell the user rather than silently running something else.

const SensoryVector = require('./SensoryVector');

// Action space: 4 absolute headings + hold + halt + reverse + 2 body turns.
//
// Headings alone leave gaps a real animal does not have. A creature that wants
// to stay put has to spend every tick re-choosing a heading it then walks along,
// and one that wants to back out of a dead end has to turn around (two ticks
// facing the wrong way) because there is no way to say "same facing, opposite
// travel". Both are cheap to express and expensive to evolve around, so they get
// their own channels: HALT keeps the body still while the brain keeps thinking,
// REVERSE moves against the current heading without turning the body.
//
// TURN_L / TURN_R rotate the body itself, which is the only way the brain can
// aim its eyes. Eyes look along `org.rotation + eye.direction`, while movement
// follows `org.direction` — two separate fields. Before these channels existed
// only attemptRotate() ever wrote rotation, and it picked at RANDOM and only
// when the organism was stuck, so a direction output made the body strafe
// sideways with its eyes still pointing the old way, and eye orientation was
// never under selection: there was no stable "forward" for a forward-facing eye
// to evolve toward. Measured in Research/harness/ux_probe/eye_vs_heading.js
const ACTIONS = {
    UP: 0, DOWN: 1, RIGHT: 2, LEFT: 3,
    HOLD: 4,      // keep the current heading and keep moving
    HALT: 5,      // stay in place this tick
    REVERSE: 6,   // travel opposite the current heading, body unturned
    TURN_L: 7,    // rotate the body (and its eyes) one step left
    TURN_R: 8,    // rotate the body (and its eyes) one step right
};
const ACTION_N = 9;
const ACTION_NAMES = ['up', 'down', 'right', 'left', 'hold', 'halt', 'reverse', 'turn-L', 'turn-R'];

// Sense channel count is owned by SensoryVector; the brain just needs the width.
const SENSE_N = SensoryVector.CHANNELS;

const BRAIN_LIMITS = {
    // N_MIN is 4, not 1: shared_n >= 1 means N=1 leaves zero private channels,
    // and a brain with no private state cannot hold a thought between ticks.
    N_MIN: 4,
    N_MAX: 64,
    SHARED_FRAC_MIN: 0,
    SHARED_FRAC_MAX: 0.9,
    RADIUS_MIN: 2,
    RADIUS_MAX: 80,
    LEAK_MIN: 0,
    LEAK_MAX: 0.99,
    MUT_SIGMA_MIN: 0,
    MUT_SIGMA_MAX: 1,
    TILE_MIN: 1,
    TILE_MAX: 32,
};

/** Clamp a number into [lo, hi], falling back to `fallback` if it isn't one. */
function clampNum(value, lo, hi, fallback) {
    const v = Number(value);
    if (!Number.isFinite(v)) return { value: fallback, changed: true, reason: 'not a number' };
    if (v < lo) return { value: lo, changed: true, reason: `below minimum ${lo}` };
    if (v > hi) return { value: hi, changed: true, reason: `above maximum ${hi}` };
    return { value: v, changed: false };
}

/**
 * Turn any (N, frac) request into a shape the engine can actually run.
 *
 * Invariants guaranteed on the result:
 *   - N is an integer in [N_MIN, N_MAX]
 *   - shared_n is an integer in [0, N-1]  -> at least one private channel always
 *   - a non-zero requested fraction never rounds down to zero shared channels,
 *     so asking for "a little collective" never silently gives none
 */
function clampBrainShape(N, frac) {
    const adjusted = [];
    const L = BRAIN_LIMITS;

    let n = Math.round(Number(N));
    if (!Number.isFinite(n)) {
        adjusted.push('Brain size was not a number; using 16.');
        n = 16;
    }
    if (n < L.N_MIN) {
        adjusted.push(`Brain size ${n} is too small (a brain needs private state); using ${L.N_MIN}.`);
        n = L.N_MIN;
    } else if (n > L.N_MAX) {
        adjusted.push(`Brain size ${n} exceeds the limit; using ${L.N_MAX}.`);
        n = L.N_MAX;
    }

    let f = Number(frac);
    if (!Number.isFinite(f)) {
        adjusted.push('Collective share was not a number; using 0.5.');
        f = 0.5;
    }
    if (f < L.SHARED_FRAC_MIN) {
        adjusted.push(`Collective share ${f} is below ${L.SHARED_FRAC_MIN}; using ${L.SHARED_FRAC_MIN}.`);
        f = L.SHARED_FRAC_MIN;
    } else if (f > L.SHARED_FRAC_MAX) {
        adjusted.push(`Collective share ${f} is above ${L.SHARED_FRAC_MAX}; using ${L.SHARED_FRAC_MAX}.`);
        f = L.SHARED_FRAC_MAX;
    }

    let shared_n = Math.round(n * f);
    if (f > 0 && shared_n < 1) {
        adjusted.push(`A collective share of ${f} at N=${n} rounds to 0 channels; using 1.`);
        shared_n = 1;
    }
    if (shared_n > n - 1) {
        adjusted.push(`Collective share capped at ${n - 1} of ${n} channels so one stays private.`);
        shared_n = n - 1;
    }
    if (shared_n < 0) shared_n = 0;

    return {
        N: n,
        shared_n,
        private_n: n - shared_n,
        frac: f,
        sense_n: SENSE_N,
        action_n: ACTION_N,
        params: n * n + n * SENSE_N + ACTION_N * n + n + 1,
        adjusted,
    };
}

/** Clamp the collective field knobs that are safe to change live. */
function clampFieldParams(radius, leak, tile_size) {
    const L = BRAIN_LIMITS;
    const adjusted = [];

    const r = clampNum(Math.round(radius), L.RADIUS_MIN, L.RADIUS_MAX, 20);
    if (r.changed) adjusted.push(`Influence radius ${radius} ${r.reason}; using ${r.value}.`);

    const lk = clampNum(leak, L.LEAK_MIN, L.LEAK_MAX, 0.85);
    if (lk.changed) adjusted.push(`Field memory ${leak} ${lk.reason}; using ${lk.value}.`);

    const t = clampNum(Math.round(tile_size), L.TILE_MIN, L.TILE_MAX, 6);
    if (t.changed) adjusted.push(`Field tile size ${tile_size} ${t.reason}; using ${t.value}.`);

    return { radius: r.value, leak: lk.value, tile_size: t.value, adjusted };
}

/**
 * Brain weight mutation strength implied by a body's mutation rate.
 *
 * With evolved mutation rates the body's rate is itself inherited and drifts, so
 * tying the brain's sigma to it makes a lineage's physical and mental volatility
 * one evolvable trait: a lineage whose body settles down shifts its mind into
 * fine-tuning, while an unsettled one keeps searching broadly. That coupling is
 * the point -- it only exists while the rate is a heritable trait, which is why
 * the fixed-rate mode keeps its own independent dial.
 *
 * The slope puts the default rate of 15 at 0.24, three times the hand-set 0.08,
 * so the same setting that makes sighted organisms appear also widens the search
 * that diversifies them. Clamped to the same bounds as the manual control, so a
 * lineage that evolves an extreme rate cannot push sigma out of range.
 *
 * `coupling` is how strongly this particular lineage ties the two together. A
 * fixed ratio of 1 leaves a lineage that wants to protect a working brain only
 * one lever -- freezing its body -- and measured runs did exactly that, driving
 * the rate to 1 and stalling anatomical search to buy neural stability. Letting
 * the ratio evolve separates the two decisions: a lineage can hold a mutable
 * body and a calm mind, or the reverse, instead of paying for one with the other.
 */
const SIGMA_PER_MUTABILITY = 0.016;

function brainSigmaFor(mutability, coupling = 1) {
    const m = Number(mutability);
    if (!Number.isFinite(m) || m <= 0) return 0;
    const k = Number.isFinite(Number(coupling)) ? Number(coupling) : 1;
    return Math.min(BRAIN_LIMITS.MUT_SIGMA_MAX,
        Math.max(BRAIN_LIMITS.MUT_SIGMA_MIN, m * SIGMA_PER_MUTABILITY * k));
}

/**
 * Bounds on the evolvable brain/body coupling ratio.
 *
 * These are guard rails, not a tuning range: they exist so evolution can neither
 * stop nor blow up, and everything between them is the lineages' business. The
 * floor is one step rather than zero because zero would freeze a brain's weights
 * permanently -- a lineage could evolve its way out of having a mind at all, with
 * no path back since a frozen brain cannot rediscover anything. One step still
 * mutates, twenty times slower than the default. The ceiling is where a lineage
 * at the default rate reaches sigma 0.96, just under the manual maximum of 1, so
 * the full usable strength is inside the range and anything beyond it would only
 * be clamped away. The step stays coarse enough that a drift is a real decision
 * rather than noise, and divides both bounds exactly so a lineage can sit on
 * either.
 */
const COUPLING_MIN = 0.05;
const COUPLING_MAX = 4;
const COUPLING_STEP = 0.05;
const COUPLING_DEFAULT = 1;

/** Clamp a coupling ratio, rounded to the step grid to stop float drift. */
function clampCoupling(value) {
    const k = Number(value);
    if (!Number.isFinite(k)) return COUPLING_DEFAULT;
    const snapped = Math.round(k / COUPLING_STEP) * COUPLING_STEP;
    return Math.min(COUPLING_MAX, Math.max(COUPLING_MIN,
        Math.round(snapped * 100) / 100));
}

module.exports = { BRAIN_LIMITS, ACTION_N, ACTIONS, ACTION_NAMES, SENSE_N,
                   SIGMA_PER_MUTABILITY, brainSigmaFor,
                   COUPLING_MIN, COUPLING_MAX, COUPLING_STEP, COUPLING_DEFAULT,
                   clampCoupling,
                   clampBrainShape, clampFieldParams, clampNum };
