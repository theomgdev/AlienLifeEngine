// Seedable RNG for AlienLifeEngine.
//
// The original engine called Math.random() from 24 sites across 11 files, which made
// every run unrepeatable: you could not A/B a brain design, replay a discovery, or
// write a regression test. Everything routes through here instead.
//
// Algorithm: mulberry32 — 32-bit state, passes gjrand/practrand for this scale,
// ~2x faster than Math.random() in V8 and fully deterministic from a seed.

const RNG = {
    _state: 0,
    _seed: 0,
    _calls: 0,

    // Seed the generator. Accepts a number or a string (hashed).
    seed(value) {
        if (typeof value === 'string') {
            // FNV-1a
            let h = 0x811c9dc5;
            for (let i = 0; i < value.length; i++) {
                h ^= value.charCodeAt(i);
                h = Math.imul(h, 0x01000193);
            }
            value = h >>> 0;
        }
        if (value === undefined || value === null) {
            value = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
        }
        this._seed = value >>> 0;
        this._state = this._seed;
        this._calls = 0;
        return this._seed;
    },

    getSeed() { return this._seed; },
    getCallCount() { return this._calls; },

    // Snapshot/restore for deterministic save-load and replay.
    getState() { return { state: this._state, seed: this._seed, calls: this._calls }; },
    setState(s) {
        this._state = s.state >>> 0;
        this._seed = s.seed >>> 0;
        this._calls = s.calls || 0;
    },

    // Uniform [0, 1)
    random() {
        this._calls++;
        let s = (this._state = (this._state + 0x6D2B79F5) | 0);
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    // Integer in [0, n)
    randInt(n) {
        return Math.floor(this.random() * n);
    },

    // Uniform in [a, b)
    range(a, b) {
        return a + this.random() * (b - a);
    },

    // true with probability p (p in 0..1)
    chance(p) {
        return this.random() < p;
    },

    // true with probability pct (pct in 0..100) — matches the engine's existing style
    percent(pct) {
        return this.random() * 100 < pct;
    },

    // Random element of an array
    pick(arr) {
        return arr[Math.floor(this.random() * arr.length)];
    },

    // Standard normal via Box-Muller, with the spare value cached.
    _spare: null,
    gauss() {
        if (this._spare !== null) {
            const v = this._spare;
            this._spare = null;
            return v;
        }
        let u, v, s;
        do {
            u = this.random() * 2 - 1;
            v = this.random() * 2 - 1;
            s = u * u + v * v;
        } while (s >= 1 || s === 0);
        const mul = Math.sqrt((-2 * Math.log(s)) / s);
        this._spare = v * mul;
        return u * mul;
    },
};

// Seed from a URL hash (?seed=...) when present so a run is shareable, else random.
(function initialSeed() {
    let s = null;
    if (typeof window !== 'undefined' && window.location && window.location.search) {
        const m = window.location.search.match(/[?&]seed=([^&]+)/);
        if (m) s = decodeURIComponent(m[1]);
    }
    RNG.seed(s === null ? undefined : (isNaN(Number(s)) ? s : Number(s)));
})();

module.exports = RNG;
