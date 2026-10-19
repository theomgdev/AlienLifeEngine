// CollectiveField — the shared substrate of the hive mind.
//
// THE CORE IDEA OF AlienLifeEngine
// ---------------------------------
// Every sighted organism carries an NxN recurrent brain whose state
// vector h is split: the first `shared_n` channels (half by default) are NOT private.
// They are read from, and written back into, a coarse spatial field laid over the
// world grid. So half of every mind lives outside the body, in a substrate that
// its neighbours also think with.
//
// Crucially the WEIGHTS are not shared, only the STATE. Each organism interprets the
// collective channels through its own evolved matrix, so there is no common language —
// there is a common *substrate*, and what it means is evolved separately in every
// lineage. That is the alien part: in nature neurons cannot cross the skull.
//
// WHY LOCAL AND NOT GLOBAL
// ------------------------
// A single global mean was measured and it collapses at scale: the shared slice's
// temporal std fell 0.0238 (pop 50) -> 0.0036 (pop 5000), i.e. 1/pop averaging turns
// the collective into a dead constant. Scoping the pool to tiles keeps it alive at
// every population (~20x more signal, measured) at +0.2% cost, and has two bonuses:
//   - it is biologically honest (pheromone / quorum sensing are local)
//   - it is RENDERABLE: regional cultures appear as colour patches on the map
// See Research/harness/harness_faz0/local_vs_global_collective.js
//
// Update rule per tile, per channel:
//   field = leak * field + (1 - leak) * mean(contributions this tick)
// The leak gives the collective memory: a region's "mood" persists across ticks
// instead of being a per-tick average.

// ORGANISM-CENTRED AND CIRCULAR
// -----------------------------
// The field is stored on a tile grid for speed, but organisms do not snap to a tile.
// Each one reads and writes through a circular kernel centred on its own body, with
// influence falling smoothly to zero at `radius` grid cells. A mind's reach is a
// disc around itself, not the square cell it happens to stand in. Two consequences:
//   - no artificial square boundaries: an organism one step away shares almost the
//     same collective state instead of flipping to a different tile's value
//   - the rendered field becomes organic blobs around populations, not a chessboard
// Kernel offsets and weights are precomputed per resize, so a read or write is a
// flat walk over a small offset table with no allocation.

class CollectiveField {
    /**
     * @param {number} cols        world grid columns
     * @param {number} rows        world grid rows
     * @param {number} tile_size   grid cells per storage tile (field resolution)
     * @param {number} channels    shared channel count (= shared_n of the brain)
     * @param {number} leak        0..1, how much of the previous value is kept
     * @param {number} radius      influence radius in GRID CELLS (the disc size)
     */
    constructor(cols, rows, tile_size, channels, leak = 0.85, radius = 18) {
        this.leak = leak;
        this.radius = radius;
        this.resize(cols, rows, tile_size, channels);
    }

    resize(cols, rows, tile_size, channels = this.channels, radius = this.radius) {
        this.cols = cols;
        this.rows = rows;
        this.tile_size = Math.max(1, tile_size | 0);
        this.channels = channels;
        this.radius = Math.max(this.tile_size, radius | 0);
        this.tile_cols = Math.max(1, Math.ceil(cols / this.tile_size));
        this.tile_rows = Math.max(1, Math.ceil(rows / this.tile_size));
        this.tiles = this.tile_cols * this.tile_rows;

        const n = this.tiles * this.channels;
        this.field = new Float32Array(n);            // current collective state
        this.accum = new Float32Array(n);            // weighted contributions this tick
        this.weight = new Float32Array(this.tiles);  // weight sum per tile this tick
        // Tiles that hold state or were written this tick. commit() walks this
        // list instead of the whole grid: on a large world most tiles are empty
        // and decaying an exact zero toward zero is work with no result. A tile
        // enters on write() and leaves once it has faded to nothing.
        this._live = new Int32Array(this.tiles);
        this._isLive = new Uint8Array(this.tiles);
        this._liveCount = 0;

        this._buildKernel();
    }

    /** Mark a tile as holding state, so commit() keeps visiting it. */
    _touch(t) {
        if (this._isLive[t]) return;
        this._isLive[t] = 1;
        this._live[this._liveCount++] = t;
    }

    /**
     * Precompute the circular kernel: tile offsets within `radius` grid cells of a
     * centre, each with a smooth falloff weight. Computing this once turns every
     * read and write into a short loop over a flat table.
     */
    _buildKernel() {
        const rTiles = Math.max(1, Math.round(this.radius / this.tile_size));
        const dx = [], dy = [], w = [];
        for (let ty = -rTiles; ty <= rTiles; ty++) {
            for (let tx = -rTiles; tx <= rTiles; tx++) {
                const d = Math.sqrt(tx * tx + ty * ty);
                if (d > rTiles + 0.0001) continue;          // outside the disc
                // cosine window: 1 at the centre, 0 at the rim
                const weight = 0.5 * (1 + Math.cos(Math.PI * (d / (rTiles + 0.0001))));
                if (weight <= 0.0001) continue;
                dx.push(tx); dy.push(ty); w.push(weight);
            }
        }
        this._kdx = Int32Array.from(dx);
        this._kdy = Int32Array.from(dy);
        this._kw = Float32Array.from(w);
        this._kn = w.length;
        this.kernel_tiles = w.length;
    }

    clear() {
        this.field.fill(0);
        this.accum.fill(0);
        this.weight.fill(0);
    }

    tileIndex(col, row) {
        let tx = (col / this.tile_size) | 0;
        let ty = (row / this.tile_size) | 0;
        if (tx < 0) tx = 0; else if (tx >= this.tile_cols) tx = this.tile_cols - 1;
        if (ty < 0) ty = 0; else if (ty >= this.tile_rows) ty = this.tile_rows - 1;
        return ty * this.tile_cols + tx;
    }

    /**
     * Read the collective state in the disc around a world position, distance
     * weighted, into `out[0..channels)`.
     */
    read(col, row, out) {
        const { channels, tile_cols, tile_rows, field, _kdx, _kdy, _kw, _kn } = this;
        const cx = (col / this.tile_size) | 0;
        const cy = (row / this.tile_size) | 0;
        for (let i = 0; i < channels; i++) out[i] = 0;
        let wsum = 0;
        for (let k = 0; k < _kn; k++) {
            const tx = cx + _kdx[k];
            if (tx < 0 || tx >= tile_cols) continue;
            const ty = cy + _kdy[k];
            if (ty < 0 || ty >= tile_rows) continue;
            const wk = _kw[k];
            const base = (ty * tile_cols + tx) * channels;
            for (let i = 0; i < channels; i++) out[i] += field[base + i] * wk;
            wsum += wk;
        }
        if (wsum > 0) {
            const inv = 1 / wsum;
            for (let i = 0; i < channels; i++) out[i] *= inv;
        }
    }

    /**
     * Deposit this organism's post-step shared channels into the disc around it,
     * distance weighted. Averaged against every other contributor at commit().
     */
    write(col, row, values) {
        const { channels, tile_cols, tile_rows, accum, weight, _kdx, _kdy, _kw, _kn } = this;
        const cx = (col / this.tile_size) | 0;
        const cy = (row / this.tile_size) | 0;
        for (let k = 0; k < _kn; k++) {
            const tx = cx + _kdx[k];
            if (tx < 0 || tx >= tile_cols) continue;
            const ty = cy + _kdy[k];
            if (ty < 0 || ty >= tile_rows) continue;
            const wk = _kw[k];
            const t = ty * tile_cols + tx;
            const base = t * channels;
            for (let i = 0; i < channels; i++) accum[base + i] += values[i] * wk;
            weight[t] += wk;
            this._touch(t);
        }
    }

    /**
     * Fold this tick's contributions into the field. Call once per world tick,
     * after every thinking organism has run.
     */
    commit() {
        const { channels, field, accum, weight, leak, _live, _isLive } = this;
        const keep = leak;
        const take = 1 - leak;
        // A quiet region should fade fast: at leak=0.85 a tile nothing thinks in any
        // more would hold a visible ghost for hundreds of ticks, which reads on
        // screen as a culture outliving its thinkers. Decay harder when empty.
        const emptyKeep = keep * keep * keep;
        let write = 0;
        for (let idx = 0; idx < this._liveCount; idx++) {
            const t = _live[idx];
            const w = weight[t];
            const base = t * channels;
            let alive = false;
            if (w <= 0) {
                for (let i = 0; i < channels; i++) {
                    const v = field[base + i] * emptyKeep;
                    if (v > -1e-4 && v < 1e-4) {
                        field[base + i] = 0;
                    } else {
                        field[base + i] = v;
                        alive = true;
                    }
                }
            } else {
                const inv = 1 / w;
                for (let i = 0; i < channels; i++) {
                    const j = base + i;
                    field[j] = keep * field[j] + take * (accum[j] * inv);
                    // Cleared inline rather than with a per-tile fill(): the loop
                    // is already here, and 40k short fill() calls cost several
                    // times the whole sweep they were meant to tidy up.
                    accum[j] = 0;
                }
                weight[t] = 0;
                alive = true;
            }
            // A tile that has decayed to exact zero holds nothing and contributes
            // nothing, so it leaves the list until something writes to it again.
            if (alive) {
                _live[write++] = t;
            } else {
                _isLive[t] = 0;
            }
        }
        this._liveCount = write;
    }

    // ---- introspection, for rendering and for the Chronicle ----------------

    /** Mean absolute activity of a tile — drives the "culture patch" overlay. */
    tileIntensity(t) {
        const base = t * this.channels;
        let s = 0;
        for (let i = 0; i < this.channels; i++) s += Math.abs(this.field[base + i]);
        return s / this.channels;
    }

    /** Raw channel values of a tile (shared slice of the local hive mind). */
    tileVector(t) {
        const base = t * this.channels;
        return this.field.subarray(base, base + this.channels);
    }

    /** Mean activity across the field — "how loudly the world is thinking". */
    meanIntensity() {
        let s = 0;
        for (let t = 0; t < this.tiles; t++) s += this.tileIntensity(t);
        return this.tiles ? s / this.tiles : 0;
    }

    /**
     * How differentiated the world's collective is: mean pairwise distance between
     * tile vectors and the global mean. High = regional cultures, low = one monoculture.
     */
    spatialDivergence() {
        if (this.tiles < 2) return 0;
        const mean = new Float64Array(this.channels);
        for (let t = 0; t < this.tiles; t++) {
            const base = t * this.channels;
            for (let i = 0; i < this.channels; i++) mean[i] += this.field[base + i];
        }
        for (let i = 0; i < this.channels; i++) mean[i] /= this.tiles;

        let total = 0;
        for (let t = 0; t < this.tiles; t++) {
            const base = t * this.channels;
            let d = 0;
            for (let i = 0; i < this.channels; i++) {
                const diff = this.field[base + i] - mean[i];
                d += diff * diff;
            }
            total += Math.sqrt(d);
        }
        return total / this.tiles;
    }

    serialize() {
        return {
            tile_size: this.tile_size,
            channels: this.channels,
            leak: this.leak,
            radius: this.radius,
            tile_cols: this.tile_cols,
            tile_rows: this.tile_rows,
            field: Array.from(this.field),
        };
    }

    loadRaw(raw) {
        this.tile_size = raw.tile_size;
        this.channels = raw.channels;
        this.leak = raw.leak;
        if (raw.radius) this.radius = raw.radius;
        this.tile_cols = raw.tile_cols;
        this.tile_rows = raw.tile_rows;
        this.tiles = this.tile_cols * this.tile_rows;
        this.field = new Float32Array(raw.field);
        this.accum = new Float32Array(this.field.length);
        this.weight = new Float32Array(this.tiles);
        // A loaded field arrives mid-decay, so every tile carrying state has to
        // re-enter the live list: commit() only visits what is listed, and a tile
        // left out would hold its culture frozen for the rest of the world's life.
        this._live = new Int32Array(this.tiles);
        this._isLive = new Uint8Array(this.tiles);
        this._liveCount = 0;
        for (let t = 0; t < this.tiles; t++) {
            const base = t * this.channels;
            for (let i = 0; i < this.channels; i++) {
                if (this.field[base + i] !== 0) { this._touch(t); break; }
            }
        }
        this._buildKernel();
    }
}

module.exports = CollectiveField;
