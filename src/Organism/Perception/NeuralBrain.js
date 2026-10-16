// NeuralBrain — an Elman-style recurrent brain whose state vector is part private
// and part shared with every other thinking organism through the CollectiveField.
//
// Replaces the original lookup-table Brain. That table had 8 free variables x 3
// choices = 3^8 = 6561 possible brains, and its default (chase food, flee killers)
// was already the global optimum — so brain evolution was dead on arrival.
//
//   h  = [ shared (from the field) | private (persists in the arena) ]
//   h' = tanh( RMSNorm(W h + Win s + b) * gain )
//   a  = Wout h'                     -> argmax picks the action
//   private part -> written back to the arena
//   shared part  -> contributed back to the organism's local field tile
//
// Senses enter through their own matrix Win and actions leave through Wout. They
// used to share h directly — senses overwriting the leading private channels and
// actions being read off the trailing ones — which made N a three-way budget
// between perception, memory and action. At N=16 with a 0.5 shared fraction that
// left zero surviving memory channels (scrambling the stored state changed the
// output by exactly 0.0) and silently dropped 3 of the 11 senses. Now every
// channel of h is memory, and all senses always arrive.
// Measured in Research/harness/ux_probe/mem_alive.js
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
const { ACTIONS } = require('./BrainShape');

// What think() tells the organism it wants. Returned instead of a bare boolean
// because a brain can now ask for things that are not "I turned": standing still
// and backing up are decisions, and the caller must be able to tell them from
// indecision — otherwise the fallback logic would rotate a creature that
// deliberately chose to hold position.
const INTENT_NONE    = 0;   // no strong opinion; carry on
const INTENT_TURNED  = 1;   // picked a new heading
const INTENT_HALT    = 2;   // stay put this tick
const INTENT_REVERSE = 3;   // move against the current heading

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
        const sense_n = arena.sense_n;
        const action_n = arena.action_n;
        ensureScratch(N);

        const W = arena.W, Win = arena.Win, Wout = arena.Wout;
        const b = arena.b, hPriv = arena.hPriv;
        const wOff = arena.wOffset(this.slot);
        const inOff = arena.winOffset(this.slot);
        const outOff = arena.woutOffset(this.slot);
        const bOff = arena.bOffset(this.slot);
        const pOff = arena.pOffset(this.slot);
        const gain = arena.gain[this.slot];

        const org = this.owner;

        // --- assemble h = [shared | private] ---------------------------------
        // Every channel of h is state. Senses no longer overwrite any of it, and
        // actions are no longer read out of it: both go through their own weight
        // matrices, so N is a pure memory budget.
        if (this.field) {
            this.field.read(org.c, org.r, _shared);
            for (let i = 0; i < shared_n; i++) _hFull[i] = _shared[i];
        } else {
            for (let i = 0; i < shared_n; i++) _hFull[i] = 0;
        }
        for (let i = 0; i < private_n; i++) _hFull[shared_n + i] = hPriv[pOff + i];

        // --- h' = tanh(RMSNorm(W h + Win s + b) * gain) -----------------------
        let ms = 0;
        for (let r = 0; r < N; r++) {
            let sum = b[bOff + r];
            const rowOff = wOff + r * N;
            for (let c = 0; c < N; c++) sum += W[rowOff + c] * _hFull[c];
            if (senses && sense_n > 0) {
                const sRowOff = inOff + r * sense_n;
                const lim = senses.length < sense_n ? senses.length : sense_n;
                for (let c = 0; c < lim; c++) sum += Win[sRowOff + c] * senses[c];
            }
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

        // --- action readout: a = Wout h' --------------------------------------
        // The whole of h' feeds every action, so memory and perception both reach
        // the decision. Channels: 0-3 headings, 4 hold, 5 halt, 6 reverse.
        let best = -Infinity, bestIdx = -1;
        for (let a = 0; a < action_n; a++) {
            let sum = 0;
            const rowOff = outOff + a * N;
            for (let c = 0; c < N; c++) sum += Wout[rowOff + c] * _hNext[c];
            if (sum > best) { best = sum; bestIdx = a; }
        }
        this.last_output = best;
        this.last_action = bestIdx;

        // Below threshold the brain has no strong opinion: carry on as before.
        if (best < Hyperparams.brainActionThreshold) return INTENT_NONE;

        switch (bestIdx) {
            case ACTIONS.HALT:
                return INTENT_HALT;
            case ACTIONS.REVERSE:
                return INTENT_REVERSE;
            case ACTIONS.HOLD:
                return INTENT_NONE;
            default:
                org.changeDirection(bestIdx);   // 0..3 map onto Directions.up..left
                return INTENT_TURNED;
        }
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
            sense_n: arena.sense_n,
            action_n: arena.action_n,
            params: arena.paramCount(),
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
        const sense_n = arena.sense_n, action_n = arena.action_n;
        return {
            type: 'neural',
            N,
            shared_n: arena.shared_n,
            sense_n,
            action_n,
            gain: arena.gain[this.slot],
            W: Array.from(arena.W.subarray(arena.wOffset(this.slot), arena.wOffset(this.slot) + N * N)),
            Win: Array.from(arena.Win.subarray(arena.winOffset(this.slot), arena.winOffset(this.slot) + N * sense_n)),
            Wout: Array.from(arena.Wout.subarray(arena.woutOffset(this.slot), arena.woutOffset(this.slot) + action_n * N)),
            b: Array.from(arena.b.subarray(arena.bOffset(this.slot), arena.bOffset(this.slot) + N)),
        };
    }

    loadRaw(raw) {
        if (!raw || !this.arena) return;
        if (this.slot < 0) this.slot = this.arena.alloc();
        const arena = this.arena;
        const N = arena.N;
        const sense_n = arena.sense_n, action_n = arena.action_n;

        // A saved brain may have been built at a different N, sense count or
        // action count. Copy row by row where the shapes overlap and leave the
        // rest at whatever the slot already holds, rather than copying a flat
        // run that would smear one row's weights across the next.
        const rawN = raw.N || N;
        const rawS = raw.sense_n || 0;
        const rawA = raw.action_n || 0;

        const wOff = arena.wOffset(this.slot);
        if (raw.W) {
            const rows = Math.min(N, rawN), cols = Math.min(N, rawN);
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                    arena.W[wOff + r * N + c] = raw.W[r * rawN + c];
        }

        if (raw.Win && sense_n > 0 && rawS > 0) {
            const inOff = arena.winOffset(this.slot);
            const rows = Math.min(N, rawN), cols = Math.min(sense_n, rawS);
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                    arena.Win[inOff + r * sense_n + c] = raw.Win[r * rawS + c];
        }

        if (raw.Wout && action_n > 0 && rawA > 0) {
            const outOff = arena.woutOffset(this.slot);
            const rows = Math.min(action_n, rawA), cols = Math.min(N, rawN);
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                    arena.Wout[outOff + r * N + c] = raw.Wout[r * rawN + c];
        }

        const bOff = arena.bOffset(this.slot);
        const nB = Math.min(N, raw.b ? raw.b.length : 0);
        for (let i = 0; i < nB; i++) arena.b[bOff + i] = raw.b[i];

        arena.gain[this.slot] = raw.gain !== undefined ? raw.gain : 1;
    }
}

module.exports = NeuralBrain;
module.exports.INTENT_NONE = INTENT_NONE;
module.exports.INTENT_TURNED = INTENT_TURNED;
module.exports.INTENT_HALT = INTENT_HALT;
module.exports.INTENT_REVERSE = INTENT_REVERSE;
