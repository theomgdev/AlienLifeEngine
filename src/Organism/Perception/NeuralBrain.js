// NeuralBrain — an NxN fully connected recurrent brain, 25% of whose state is shared
// with every other thinking organism through the CollectiveField.
//
// Replaces the original lookup-table Brain. That table had 8 free variables x 3
// choices = 3^8 = 6561 possible brains, and its default (chase food, flee killers)
// was already the global optimum — so brain evolution was dead on arrival. This one
// has N*N + N + 1 = 273 continuous parameters at N=16 and no ceiling on behaviour.
//
//   h = [ shared (25%, from the field) | private (75%, persists in the arena) ]
//   h' = tanh( RMSNorm(W h + b) * gain )
//   private part -> written back to the arena
//   shared part  -> contributed back to the organism's local field tile
//
// RMSNorm per timestep is not optional. Mutation has no upper bound on |W|, so
// evolution inflates weights over generations; measured saturation of tanh at
// weight scale 8.0 was 89.0% without norm vs 0.3% with it, and healthy weight
// scales went from 3/6 to 6/6. Cost is nil (measured slightly faster, since the
// normalised values keep tanh in its cheap range).
// See Research/harness/harness_faz0/rmsnorm_ablation.js
//
// Everything here is evolved. No gradients, no reward signal, no backprop.

const Hyperparams = require('../../Hyperparameters');
const RNG = require('../../Utils/RNG');
const Directions = require('../Directions');

const EPS = 1e-8;

// Scratch buffers shared by every brain — only one brain runs at a time, so these
// never need to be per-instance. Keeps per-tick allocation at exactly zero.
let _hFull = null;
let _hNext = null;
let _shared = null;
let _scratchN = 0;

function ensureScratch(N) {
    if (_scratchN >= N && _hFull) return;
    _hFull = new Float32Array(N);
    _hNext = new Float32Array(N);
    _shared = new Float32Array(N);
    _scratchN = N;
}

class NeuralBrain {
    constructor(owner) {
        this.owner = owner;
        this.arena = null;      // assigned on attach
        this.slot = -1;
        this.field = null;
        // sensory vector is filled by SensoryVector before each decide()
        this.sense = null;
        this.last_output = 0;
    }

    /** Attach to the world's arena + collective field, taking a fresh slot. */
    attach(arena, field) {
        this.arena = arena;
        this.field = field;
        if (this.slot < 0) {
            this.slot = arena.alloc();
            arena.randomize(this.slot, RNG, Hyperparams.brainInitScale);
        }
        return this;
    }

    detach() {
        if (this.arena && this.slot >= 0) {
            this.arena.release(this.slot);
            this.slot = -1;
        }
    }

    /** Inherit a parent's weights. Structure is passed on, state is not. */
    copy(parentBrain) {
        if (!parentBrain || !parentBrain.arena || parentBrain.slot < 0) return;
        if (!this.arena) this.arena = parentBrain.arena;
        if (!this.field) this.field = parentBrain.field;
        if (this.slot < 0) this.slot = this.arena.alloc();
        this.arena.copy(parentBrain.slot, this.slot);
    }

    mutate() {
        if (!this.arena || this.slot < 0) return;
        this.arena.mutate(this.slot, RNG, Hyperparams.brainMutationSigma);
    }

    /**
     * One forward step. Returns true if the brain actively steered this tick.
     *
     * @param {Float32Array} senses  normalised sensory channels (see SensoryVector)
     */
    think(senses) {
        const arena = this.arena;
        if (!arena || this.slot < 0) return false;

        const N = arena.N;
        const shared_n = arena.shared_n;
        const private_n = arena.private_n;
        ensureScratch(N);

        const W = arena.W, b = arena.b, hPriv = arena.hPriv;
        const wOff = arena.wOffset(this.slot);
        const bOff = arena.bOffset(this.slot);
        const pOff = arena.pOffset(this.slot);
        const gain = arena.gain[this.slot];

        const org = this.owner;

        // --- assemble h = [shared | private] ---------------------------------
        if (this.field) {
            this.field.read(org.c, org.r, _shared);
            for (let i = 0; i < shared_n; i++) _hFull[i] = _shared[i];
        } else {
            for (let i = 0; i < shared_n; i++) _hFull[i] = 0;
        }
        for (let i = 0; i < private_n; i++) _hFull[shared_n + i] = hPriv[pOff + i];

        // --- inject senses over the leading private channels ------------------
        // Senses overwrite rather than add: they are the organism's window on the
        // world, and the recurrent state continues in the remaining channels.
        if (senses) {
            const inject = Math.min(senses.length, private_n);
            for (let i = 0; i < inject; i++) _hFull[shared_n + i] = senses[i];
        }

        // --- h' = tanh(RMSNorm(W h + b) * gain) ------------------------------
        let ms = 0;
        for (let r = 0; r < N; r++) {
            let sum = b[bOff + r];
            const rowOff = wOff + r * N;
            for (let c = 0; c < N; c++) sum += W[rowOff + c] * _hFull[c];
            _hNext[r] = sum;
            ms += sum * sum;
        }
        const inv = gain / Math.sqrt(ms / N + EPS);
        for (let r = 0; r < N; r++) _hNext[r] = Math.tanh(_hNext[r] * inv);

        // --- write back -------------------------------------------------------
        for (let i = 0; i < private_n; i++) hPriv[pOff + i] = _hNext[shared_n + i];
        if (this.field) {
            for (let i = 0; i < shared_n; i++) _shared[i] = _hNext[i];
            this.field.write(org.c, org.r, _shared);
        }

        // --- read an action out of the last 5 channels -------------------------
        // 4 directional channels + 1 "hold course" channel. Winner takes the tick.
        const base = N - 5;
        let best = -Infinity, bestIdx = -1;
        for (let i = 0; i < 5; i++) {
            const v = _hNext[base + i];
            if (v > best) { best = v; bestIdx = i; }
        }
        this.last_output = best;

        if (bestIdx === 4 || best < Hyperparams.brainActionThreshold) {
            return false;   // no strong opinion: keep doing what you were doing
        }
        org.changeDirection(bestIdx);   // 0..3 map onto Directions.up..left
        return true;
    }

    /** Snapshot of live activations, for the brain inspector UI. */
    inspect() {
        const arena = this.arena;
        if (!arena || this.slot < 0) return null;
        const N = arena.N, shared_n = arena.shared_n, private_n = arena.private_n;
        const sharedVals = new Float32Array(shared_n);
        if (this.field) this.field.read(this.owner.c, this.owner.r, sharedVals);
        const pOff = arena.pOffset(this.slot);
        return {
            N, shared_n, private_n,
            shared: Array.from(sharedVals),
            private: Array.from(arena.hPriv.subarray(pOff, pOff + private_n)),
            weights: Array.from(arena.W.subarray(arena.wOffset(this.slot), arena.wOffset(this.slot) + N * N)),
            gain: arena.gain[this.slot],
        };
    }

    serialize() {
        const arena = this.arena;
        if (!arena || this.slot < 0) return null;
        const N = arena.N;
        return {
            type: 'neural',
            N,
            shared_n: arena.shared_n,
            gain: arena.gain[this.slot],
            W: Array.from(arena.W.subarray(arena.wOffset(this.slot), arena.wOffset(this.slot) + N * N)),
            b: Array.from(arena.b.subarray(arena.bOffset(this.slot), arena.bOffset(this.slot) + N)),
        };
    }

    loadRaw(raw) {
        if (!raw || !this.arena) return;
        if (this.slot < 0) this.slot = this.arena.alloc();
        const arena = this.arena;
        const N = arena.N;
        const wOff = arena.wOffset(this.slot);
        const bOff = arena.bOffset(this.slot);
        // tolerate a saved brain of different N: copy what overlaps
        const nW = Math.min(N * N, raw.W ? raw.W.length : 0);
        for (let i = 0; i < nW; i++) arena.W[wOff + i] = raw.W[i];
        const nB = Math.min(N, raw.b ? raw.b.length : 0);
        for (let i = 0; i < nB; i++) arena.b[bOff + i] = raw.b[i];
        arena.gain[this.slot] = raw.gain !== undefined ? raw.gain : 1;
    }
}

module.exports = NeuralBrain;
