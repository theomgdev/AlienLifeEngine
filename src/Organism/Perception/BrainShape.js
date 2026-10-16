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

// 4 directions + 1 "hold course".
const ACTION_N = 5;

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

module.exports = { BRAIN_LIMITS, ACTION_N, SENSE_N, clampBrainShape, clampFieldParams, clampNum };
