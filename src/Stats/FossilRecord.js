const CellStates = require("../Organism/Cell/CellStates");
const SerializeHelper = require("../Utils/SerializeHelper");
const Species = require("./Species");
const SpeciesNamer = require("./SpeciesNamer");

const FossilRecord = {
    init: function(){
        this.extant_species = {};
        this.extinct_species = {};
        // Lightweight id -> {name, ancestor_id, generation} index that survives
        // fossil record trimming, so lineage walks never hit a dead end even if
        // the full fossil entry was pruned. 4000 items is negligible memory.
        this.ancestor_index = Object.create(null);

        // if an organism has fewer than this cumulative pop, discard them on extinction
        this.min_discard = 10;

        this.record_size_limit = 500; // live chart window
        this.extinct_limit = 4000;    // how many dead lineages to remember
        // The ancestry index is the only structure that grows with elapsed time
        // rather than with what is alive, so it needs its own cap. Measured at
        // ~104 new species per 1000 ticks and 123 bytes each, an uncapped index
        // reaches ~12 MB at a million ticks and ~60 MB at five million — fine on
        // a desktop, not fine on a phone, and invisible until the tab dies.
        // 20000 entries is ~2.4 MB and still traces a very deep lineage.
        this.ancestor_limit = 20000;
        // Trimming walks every live chain, so it runs on a counter rather than
        // on every birth. NaN here would disable it silently.
        this._index_adds = 0;
        SpeciesNamer.reset();
        this.resetHistory();
    },

    /**
     * Long-horizon history, separate from the 500-point chart window.
     *
     * The chart arrays are a FIFO of the last 500 samples, so at one sample per 100
     * ticks everything older than ~50k ticks was simply gone — a 400k-tick run kept
     * no trace of its first 350k. This keeps a coarse archive alongside: every
     * sample is appended, and when the archive fills it is halved by dropping every
     * other entry and the interval doubles. Memory stays bounded while the SHAPE of
     * the whole run survives at progressively coarser resolution.
     */
    resetHistory: function() {
        this.history = { ticks: [], pop: [], species: [], cells: [], extinct: [], collective: [] };
        this.history_stride = 1;      // how many samples per stored entry
        this.history_counter = 0;
        this.history_limit = 2000;
    },

    pushHistory: function(tick, pop, species, cells, extinct, collective) {
        if (this.history_counter++ % this.history_stride !== 0) return;
        const h = this.history;
        h.ticks.push(tick);
        h.pop.push(pop);
        h.species.push(species);
        h.cells.push(cells);
        h.extinct.push(extinct);
        h.collective.push(collective);
        if (h.ticks.length > this.history_limit) {
            for (const key in h) {
                const arr = h[key];
                for (let i = 0, j = 0; j < arr.length; i++, j += 2) arr[i] = arr[j];
                arr.length = Math.ceil(arr.length / 2);
            }
            this.history_stride *= 2;
        }
    },

    setEnv: function(env) {
        this.env = env;
        this.setData();
    },

    addSpecies: function(org, ancestor) {
        var new_species = new Species(org.anatomy, ancestor, this.env.total_ticks);
        this.extant_species[new_species.name] = new_species;
        this._recordIndex(new_species);
        org.species = new_species;
        return new_species;
    },

    addSpeciesObj: function(species) {
        if (this.extant_species[species.name]) {
            console.warn('Tried to add already existing species. Add failed.');
            return;
        }
        this.extant_species[species.name] = species;
        this._recordIndex(species);
        return species;
    },

    _recordIndex: function(species) {
        if (!this.ancestor_index) this.ancestor_index = Object.create(null);
        this.ancestor_index[species.id] = {
            id: species.id,
            name: species.name,
            ancestor_id: species.ancestor_id,
            generation: species.generation,
            start_tick: species.start_tick,
            end_tick: -1,
        };
        if (++this._index_adds >= 2048) {
            this._index_adds = 0;
            this.trimAncestorIndex();
        }
    },

    /**
     * Bound the ancestry index without breaking the chains it exists to walk.
     *
     * This is the only structure that grows with elapsed time rather than with
     * the living population, so a long run on a phone would eventually spend
     * tens of megabytes on species nobody can name. Dropping the oldest ids
     * would sever every lineage at its root, so instead the entries still
     * REACHABLE from something that matters are kept: every extant species and
     * every remembered fossil, walked back to its origin.
     *
     * Reachability alone is a FLOOR, not a ceiling. With thousands of fossils
     * each retaining a chain, the reachable set measured ~11,800 entries on its
     * own — a smaller cap simply could not be met. So when reachability leaves
     * too much, the least significant fossils give up their chains too, poorest
     * lineages first, which is the same ordering trimExtinct already uses.
     */
    trimAncestorIndex: function() {
        const idx = this.ancestor_index;
        if (!idx) return;
        if (Object.keys(idx).length <= this.ancestor_limit) return;

        const walk = (start_id, into, limit) => {
            let id = start_id;
            while (id != null && !into.has(id)) {
                // A single chain can be over a thousand links deep, so the
                // budget is checked inside the walk, not only before it. The
                // outer check alone let one deep fossil overshoot the cap by
                // its entire length.
                if (limit !== undefined && into.size >= limit) return;
                into.add(id);
                const node = idx[id];
                if (!node) break;
                id = node.ancestor_id;
            }
        };

        // Living species are never negotiable: their ancestry is what the
        // lineage panel draws right now, so it is added with no limit.
        const keep = new Set();
        for (const s of Object.values(this.extant_species)) walk(s.id, keep);

        // Fossils are added back richest-first until the budget runs out, so
        // what survives a very long run is the lineages that actually mattered.
        // The budget can never go below living ancestry, which is why it is the
        // larger of the two.
        const budget = Math.max(this.ancestor_limit, keep.size);
        const fossils = Object.values(this.extinct_species)
            .sort((a, b) => b.cumulative_pop - a.cumulative_pop);
        for (const f of fossils) {
            if (keep.size >= budget) break;
            walk(f.id, keep, budget);
        }

        for (const id of Object.keys(idx)) {
            if (!keep.has(Number(id)) && !keep.has(id)) delete idx[id];
        }
    },

    changeSpeciesName: function(species, new_name) {
        if (this.extant_species[new_name]) {
            console.warn('Tried to change species name to an existing species name. Change failed.');
            return;
        }
        delete this.extant_species[species.name];
        species.name = new_name;
        this.extant_species[new_name] = species;
    },

    numExtantSpecies() {return Object.values(this.extant_species).length},
    numExtinctSpecies() {return Object.values(this.extinct_species).length},
    speciesIsExtant(species_name) {return !!this.extant_species[species_name]},

    /**
     * A body the editor can rebuild, kept as plain numbers rather than live cells.
     *
     * The fossil record deliberately drops the heavy Anatomy object, but cell
     * COUNTS alone cannot be drawn: a name in the Chronicle is only clickable if
     * the positions survived too. This is three numbers per cell plus an eye's
     * facing, so a full 4000-fossil record costs roughly a megabyte and nothing
     * per tick — the copy happens once, at death.
     */
    snapshotAnatomy: function(anatomy) {
        if (!anatomy || !anatomy.cells) return null;
        const cells = [];
        for (const cell of anatomy.cells) {
            const entry = {
                c: cell.loc_col,
                r: cell.loc_row,
                s: cell.state ? cell.state.name : 'mouth',
            };
            // Only eyes carry a facing, and it decides what the body can see.
            if (cell.direction !== undefined) entry.d = cell.direction;
            cells.push(entry);
        }
        return { cells, birth_distance: anatomy.birth_distance };
    },

    fossilize: function(species) {
        if (!this.extant_species[species.name]) {
            console.warn('Tried to fossilize non existing species.');
            return false;
        }
        species.end_tick = this.env.total_ticks;
        // ancestor_id survives; only the heavy object reference is dropped.
        species.ancestor = undefined;
        delete this.extant_species[species.name];
        if (species.cumulative_pop >= this.min_discard) {
            // The upstream engine left a `// TODO: store as extinct species` here,
            // so numExtinctSpecies() was permanently 0 and every dead lineage
            // vanished. Keeping a lightweight record instead: no anatomy object,
            // just the facts needed to draw a phylogeny and tell its story.
            this.extinct_species[species.name] = {
                id: species.id,
                name: species.name,
                ancestor_id: species.ancestor_id,
                generation: species.generation,
                start_tick: species.start_tick,
                end_tick: species.end_tick,
                peak_pop: species.peak_pop,
                cumulative_pop: species.cumulative_pop,
                cell_counts: species.cell_counts,
                cell_total: species.cell_total,
                anatomy: this.snapshotAnatomy(species.anatomy),
            };
            this.trimExtinct();
            return true;
        }
        return false;
    },

    /**
     * Bound the fossil record. Long runs produce hundreds of thousands of species,
     * so the least significant dead ones are dropped once the cap is hit — keeping
     * the lineages that actually mattered (largest cumulative population).
     */
    trimExtinct: function() {
        const keys = Object.keys(this.extinct_species);
        if (keys.length <= this.extinct_limit) return;
        const sorted = keys.sort((a, b) =>
            this.extinct_species[a].cumulative_pop - this.extinct_species[b].cumulative_pop);
        const drop = keys.length - this.extinct_limit;
        for (let i = 0; i < drop; i++) delete this.extinct_species[sorted[i]];
    },

    /** Walk ancestor_id links back to the root. Works across extinction. */
    lineageOf: function(species) {
        const chain = [];
        let cur = species;
        const seen = new Set();
        while (cur && !seen.has(cur.id)) {
            seen.add(cur.id);
            chain.push({ id: cur.id, name: cur.name, generation: cur.generation,
                         start_tick: cur.start_tick, end_tick: cur.end_tick === undefined ? -1 : cur.end_tick });
            cur = cur.ancestor_id == null ? null : this.byId(cur.ancestor_id);
        }
        return chain;
    },

    byId: function(id) {
        // The index is the fast path and covers every species ever recorded, so
        // it is consulted first. The two linear scans below only run for an id
        // the index no longer holds: with thousands of fossils, searching them
        // first made every lineage walk quadratic and froze a long run.
        if (this.ancestor_index && this.ancestor_index[id]) return this.ancestor_index[id];
        for (const s of Object.values(this.extant_species)) if (s.id === id) return s;
        for (const s of Object.values(this.extinct_species)) if (s.id === id) return s;
        return null;
    },

    resurrect: function(species) {
        if (species.extinct) {
            species.extinct = false;
            this.extant_species[species.name] = species;
            delete this.extinct_species[species.name];
        }
    },

    setData() {
        // all parallel arrays
        this.tick_record = [];
        this.pop_counts = [];
        this.species_counts = [];
        this.av_mut_rates = [];
        this.av_cells = [];
        this.av_cell_counts = [];
        this.updateData();
    },

    updateData() {
        var tick = this.env.total_ticks;
        this.tick_record.push(tick);
        this.pop_counts.push(this.env.organisms.length);
        this.species_counts.push(this.numExtantSpecies());
        this.av_mut_rates.push(this.env.averageMutability());
        this.calcCellCountAverages();
        this.pushHistory(
            tick,
            this.env.organisms.length,
            this.numExtantSpecies(),
            this.av_cells.length ? this.av_cells[this.av_cells.length - 1] : 0,
            this.numExtinctSpecies(),
            this.env.collective_field ? this.env.collective_field.spatialDivergence() : 0
        );
        while (this.tick_record.length > this.record_size_limit) {
            this.tick_record.shift();
            this.pop_counts.shift();
            this.species_counts.shift();
            this.av_mut_rates.shift();
            this.av_cells.shift();
            this.av_cell_counts.shift();
        }
    },

    calcCellCountAverages() {
        var total_org = 0;
        var cell_counts = {};
        for (let c of CellStates.living) {
            cell_counts[c.name] = 0;
        }
        // Hoisted: numExtantSpecies() rebuilds an array of every species, so
        // asking per species made this O(S^2) -- 114 ms at 1066 species. The
        // map is untouched below, so the count cannot change mid-loop.
        const species_count = this.numExtantSpecies();
        var first=true;
        for (let s of Object.values(this.extant_species)) {
            if (!first && species_count > 10 && s.cumulative_pop < this.min_discard){
                continue;
            }
            for (let name in s.cell_counts) {
                cell_counts[name] += s.cell_counts[name] * s.population;
            }
            total_org += s.population;
            first=false;
        }
        if (total_org == 0) {
            this.av_cells.push(0);
            this.av_cell_counts.push(cell_counts);
            return;
        }

        var total_cells = 0;
        for (let c in cell_counts) {
            total_cells += cell_counts[c];
            cell_counts[c] /= total_org;
        }
        this.av_cells.push(total_cells / total_org);
        this.av_cell_counts.push(cell_counts);
    },

    getMostPopulousSpecies(){
        var max_pop = 0;
        var max_species = undefined;
        for (let s of Object.values(this.extant_species)) {
            if (s.population > max_pop) {
                max_pop = s.population;
                max_species = s;
            }
        }
        return max_species;
    },

    clear_record() {
        this.extant_species = {};
        this.extinct_species = {};
        SpeciesNamer.reset();
        this.resetHistory();
        this.setData();
    },

    serialize() {
        this.updateData();
        let record = SerializeHelper.copyNonObjects(this);
        record.records = {
            tick_record:this.tick_record,
            pop_counts:this.pop_counts,
            species_counts:this.species_counts,
            av_mut_rates:this.av_mut_rates,
            av_cells:this.av_cells,
            av_cell_counts:this.av_cell_counts,
        };
        let species = {};
        for (let s of Object.values(this.extant_species)) {
            species[s.name] = SerializeHelper.copyNonObjects(s);
            delete species[s.name].name; // the name will be used as the key, so remove it from the value
        }
        record.species = species;
        return record;
    },

    loadRaw(record) {
        SerializeHelper.overwriteNonObjects(record, this);
        for (let key in record.records) {
            this[key] = record.records[key];
        }
    }

}

FossilRecord.init();

module.exports = FossilRecord;