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
//   Win    : N*S   sensory input weights (S = sense channel count)
//   Wout   : A*N   action readout weights (A = action count)
//   b      : N     bias
//   hPriv  : P     private state (P = N - shared_n), persists across ticks
//   gain   : 1     evolvable RMSNorm gain
//
// Win/Wout exist because senses used to be written *over* the leading private
// state channels and actions read *out of* the trailing ones. That made N a
// three-way budget between perception, memory and action: at N=16 with
// shared_n=8 the 11 senses overwrote all 8 private channels, so private
// recurrent memory was provably dead (scrambling hPriv changed the output by
// exactly 0.0) and 3 senses never reached the brain at all.
// Measured in Research/harness/ux_probe/mem_alive.js.
//
// Shared state is NOT stored here — it lives in CollectiveField.

class BrainArena {
    constructor(capacity, N, shared_n, sense_n, action_n) {
        this.N = N;
        this.shared_n = shared_n;
        this.private_n = N - shared_n;
        this.sense_n = sense_n;
        this.action_n = action_n;
        this.capacity = 0;
        this.free = [];
        this.used = 0;
        this.grow(capacity);
    }

    /** Total evolvable parameters per brain. */
    paramCount() {
        const { N, sense_n, action_n } = this;
        return N * N + N * sense_n + action_n * N + N + 1;
    }

    grow(capacity) {
        const { N, private_n, sense_n, action_n } = this;
        const old = this.capacity;
        if (capacity <= old) return;

        const W = new Float32Array(capacity * N * N);
        const Win = new Float32Array(capacity * N * sense_n);
        const Wout = new Float32Array(capacity * action_n * N);
        const b = new Float32Array(capacity * N);
        const hPriv = new Float32Array(capacity * private_n);
        const gain = new Float32Array(capacity);

        if (old > 0) {
            W.set(this.W);
            Win.set(this.Win);
            Wout.set(this.Wout);
            b.set(this.b);
            hPriv.set(this.hPriv);
            gain.set(this.gain);
        }
        this.W = W;
        this.Win = Win;
        this.Wout = Wout;
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
        const { N, private_n, sense_n, action_n } = this;
        // zero the slot so a reused brain never inherits a stranger's state
        this.W.fill(0, slot * N * N, (slot + 1) * N * N);
        this.Win.fill(0, slot * N * sense_n, (slot + 1) * N * sense_n);
        this.Wout.fill(0, slot * action_n * N, (slot + 1) * action_n * N);
        this.b.fill(0, slot * N, (slot + 1) * N);
        this.hPriv.fill(0, slot * private_n, (slot + 1) * private_n);
        this.gain[slot] = 1;
        this.free.push(slot);
        this.used--;
    }

    wOffset(slot) { return slot * this.N * this.N; }
    winOffset(slot) { return slot * this.N * this.sense_n; }
    woutOffset(slot) { return slot * this.action_n * this.N; }
    bOffset(slot) { return slot * this.N; }
    pOffset(slot) { return slot * this.private_n; }

    /** Randomise a slot — used for the first brain of a lineage. */
    randomize(slot, rng, scale = 0.6) {
        const { N, private_n, sense_n, action_n } = this;
        const wOff = this.wOffset(slot);
        const inOff = this.winOffset(slot);
        const outOff = this.woutOffset(slot);
        const bOff = this.bOffset(slot);
        const pOff = this.pOffset(slot);
        for (let i = 0; i < N * N; i++) this.W[wOff + i] = rng.gauss() * scale;
        for (let i = 0; i < N * sense_n; i++) this.Win[inOff + i] = rng.gauss() * scale;
        for (let i = 0; i < action_n * N; i++) this.Wout[outOff + i] = rng.gauss() * scale;
        for (let i = 0; i < N; i++) this.b[bOff + i] = rng.gauss() * 0.1;
        for (let i = 0; i < private_n; i++) this.hPriv[pOff + i] = 0;
        this.gain[slot] = 1;
    }

    /** Copy a parent's brain into a child's slot (inheritance, before mutation). */
    copy(fromSlot, toSlot) {
        const { N, private_n, sense_n, action_n } = this;
        const fW = this.wOffset(fromSlot), tW = this.wOffset(toSlot);
        const fI = this.winOffset(fromSlot), tI = this.winOffset(toSlot);
        const fO = this.woutOffset(fromSlot), tO = this.woutOffset(toSlot);
        const fB = this.bOffset(fromSlot), tB = this.bOffset(toSlot);
        this.W.copyWithin(tW, fW, fW + N * N);
        this.Win.copyWithin(tI, fI, fI + N * sense_n);
        this.Wout.copyWithin(tO, fO, fO + action_n * N);
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
     *
     * All three matrices mutate, each in proportion to its own size, so a
     * perception weight is exactly as likely to be touched per-parameter as a
     * recurrent one. Weighting by size matters: Win and Wout are much smaller
     * than W, and mutating "one of each" would hammer them far harder.
     */
    mutate(slot, rng, sigma = 0.08) {
        const { N, sense_n, action_n } = this;
        const nW = N * N;
        const nI = N * sense_n;
        const nO = action_n * N;

        const mats = [
            { arr: this.W, off: this.wOffset(slot), n: nW },
            { arr: this.Win, off: this.winOffset(slot), n: nI },
            { arr: this.Wout, off: this.woutOffset(slot), n: nO },
        ];
        const total = nW + nI + nO;

        // jitter ~10% of every matrix
        for (const m of mats) {
            if (m.n === 0) continue;
            const jitters = Math.max(1, Math.round(m.n * 0.1));
            for (let k = 0; k < jitters; k++) {
                m.arr[m.off + rng.randInt(m.n)] += rng.gauss() * sigma;
            }
        }

        // bias jitter
        this.b[this.bOffset(slot) + rng.randInt(N)] += rng.gauss() * sigma * 0.5;

        // rare structural moves, aimed at a matrix in proportion to its size
        const pick = () => {
            let r = rng.randInt(total);
            for (const m of mats) {
                if (m.n === 0) continue;
                if (r < m.n) return { arr: m.arr, idx: m.off + r };
                r -= m.n;
            }
            return { arr: this.W, idx: this.wOffset(slot) };
        };
        if (rng.chance(0.15)) { const t = pick(); t.arr[t.idx] = rng.gauss() * 0.6; }
        if (rng.chance(0.10)) { const t = pick(); t.arr[t.idx] = 0; }
        if (rng.chance(0.10)) {
            this.gain[slot] = Math.max(0.2, Math.min(3.0, this.gain[slot] + rng.gauss() * 0.1));
        }
    }

    stats() {
        return { capacity: this.capacity, used: this.used, free: this.free.length,
                 params: this.paramCount(),
                 bytes: this.W.byteLength + this.Win.byteLength + this.Wout.byteLength +
                        this.b.byteLength + this.hPriv.byteLength + this.gain.byteLength };
    }
}

module.exports = BrainArena;
