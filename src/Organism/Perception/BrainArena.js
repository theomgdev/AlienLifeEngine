// BrainArena — one flat weight pool for every brain in the world.
//
// Do NOT allocate a Float32Array per organism: a few thousand small typed arrays
// drown V8 in GC work. Instead every brain owns a slot index into shared buffers,
// and dead organisms return their slot to a free list. Measured at N=16 x 2000
// organisms this costs 0.96 ms/tick (5.8% of a 60fps frame) with zero per-tick
// allocation. See Research/harness/harness_faz0/collective_brain_bench.js
//
// Layout per slot:
//   W      : N*N   recurrent weight matrix (row-major)
//   b      : N     bias
//   hPriv  : P     private state (P = N - shared_n), persists across ticks
//   gain   : 1     evolvable RMSNorm gain
//
// Shared state is NOT stored here — it lives in CollectiveField.

class BrainArena {
    constructor(capacity, N, shared_n) {
        this.N = N;
        this.shared_n = shared_n;
        this.private_n = N - shared_n;
        this.capacity = 0;
        this.free = [];
        this.used = 0;
        this.grow(capacity);
    }

    grow(capacity) {
        const { N, private_n } = this;
        const old = this.capacity;
        if (capacity <= old) return;

        const W = new Float32Array(capacity * N * N);
        const b = new Float32Array(capacity * N);
        const hPriv = new Float32Array(capacity * private_n);
        const gain = new Float32Array(capacity);

        if (old > 0) {
            W.set(this.W);
            b.set(this.b);
            hPriv.set(this.hPriv);
            gain.set(this.gain);
        }
        this.W = W;
        this.b = b;
        this.hPriv = hPriv;
        this.gain = gain;

        for (let i = capacity - 1; i >= old; i--) this.free.push(i);
        this.capacity = capacity;
    }

    alloc() {
        if (this.free.length === 0) this.grow(Math.max(64, this.capacity * 2));
        this.used++;
        return this.free.pop();
    }

    release(slot) {
        if (slot < 0 || slot >= this.capacity) return;
        const { N, private_n } = this;
        // zero the slot so a reused brain never inherits a stranger's state
        this.W.fill(0, slot * N * N, (slot + 1) * N * N);
        this.b.fill(0, slot * N, (slot + 1) * N);
        this.hPriv.fill(0, slot * private_n, (slot + 1) * private_n);
        this.gain[slot] = 1;
        this.free.push(slot);
        this.used--;
    }

    wOffset(slot) { return slot * this.N * this.N; }
    bOffset(slot) { return slot * this.N; }
    pOffset(slot) { return slot * this.private_n; }

    /** Randomise a slot — used for the first brain of a lineage. */
    randomize(slot, rng, scale = 0.6) {
        const { N, private_n } = this;
        const wOff = this.wOffset(slot);
        const bOff = this.bOffset(slot);
        const pOff = this.pOffset(slot);
        for (let i = 0; i < N * N; i++) this.W[wOff + i] = rng.gauss() * scale;
        for (let i = 0; i < N; i++) this.b[bOff + i] = rng.gauss() * 0.1;
        for (let i = 0; i < private_n; i++) this.hPriv[pOff + i] = 0;
        this.gain[slot] = 1;
    }

    /** Copy a parent's brain into a child's slot (inheritance, before mutation). */
    copy(fromSlot, toSlot) {
        const { N, private_n } = this;
        const fW = this.wOffset(fromSlot), tW = this.wOffset(toSlot);
        const fB = this.bOffset(fromSlot), tB = this.bOffset(toSlot);
        this.W.copyWithin(tW, fW, fW + N * N);
        this.b.copyWithin(tB, fB, fB + N);
        // private state is NOT inherited — a newborn starts with a blank mind,
        // only the *structure* (weights) is passed on. Lamarckism stays out.
        this.hPriv.fill(0, this.pOffset(toSlot), this.pOffset(toSlot) + private_n);
        this.gain[toSlot] = this.gain[fromSlot];
    }

    /**
     * Mutate a slot in place. Pure evolution — no gradients anywhere.
     *   jitter : small gaussian nudge on a subset of weights (local search)
     *   reset  : rare full re-roll of a single weight (big jump)
     *   prune  : zero a weight / revive a zeroed one (topology search)
     *   gain   : tune RMSNorm sharpness
     */
    mutate(slot, rng, sigma = 0.08) {
        const { N } = this;
        const wOff = this.wOffset(slot);
        const bOff = this.bOffset(slot);
        const n = N * N;

        // jitter ~10% of the matrix
        const jitters = Math.max(1, Math.round(n * 0.1));
        for (let k = 0; k < jitters; k++) {
            const i = rng.randInt(n);
            this.W[wOff + i] += rng.gauss() * sigma;
        }
        // bias jitter
        this.b[bOff + rng.randInt(N)] += rng.gauss() * sigma * 0.5;

        // rare structural moves
        if (rng.chance(0.15)) this.W[wOff + rng.randInt(n)] = rng.gauss() * 0.6;
        if (rng.chance(0.10)) this.W[wOff + rng.randInt(n)] = 0;
        if (rng.chance(0.10)) {
            this.gain[slot] = Math.max(0.2, Math.min(3.0, this.gain[slot] + rng.gauss() * 0.1));
        }
    }

    stats() {
        return { capacity: this.capacity, used: this.used, free: this.free.length,
                 bytes: this.W.byteLength + this.b.byteLength + this.hPriv.byteLength + this.gain.byteLength };
    }
}

module.exports = BrainArena;
