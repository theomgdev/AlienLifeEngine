// SpeciesNamer — pronounceable names derived from an organism's body.
//
// The upstream engine named species with RNG.random().toString(36), producing
// labels like "30jtxbo5b4". Nobody follows the fate of a hash: you cannot say "the
// Velnak line survived the famine" about a base-36 string, so 400,000 ticks of
// history read as noise. Names here are generated from the anatomy itself, so a
// name carries information (what the creature is built from) and reads like a
// taxon, which is what makes a lineage feel worth watching.
//
// Form: Genus [epithet] — "Velnak", "Ocuthra minor", "Pyrrha fodiens".
// The genus comes from the body's dominant cells, so related bodies get related
// names; a counter suffix is appended only when a genus is already taken.

const CellStates = require("../Organism/Cell/CellStates");

// Onset/coda fragments chosen to stay pronounceable in any combination.
const ONSET = ['Vel', 'Oc', 'Pyr', 'Chel', 'Thal', 'Myr', 'Zan', 'Kor', 'Aur', 'Neb',
               'Sil', 'Dra', 'Esh', 'Lum', 'Vor', 'Xan', 'Cyr', 'Hal', 'Rhe', 'Tyr'];
const CODA  = ['nak', 'uthra', 'rha', 'os', 'ida', 'mex', 'ara', 'ex', 'yla', 'ion',
               'ova', 'ith', 'ane', 'ura', 'eon', 'ysa', 'oth', 'ima', 'eus', 'ax'];

// Epithets hint at what the body does, so a name doubles as a field note.
const EPITHET = {
    mouth:    ['edax', 'vorax', 'avida'],      // eater
    producer: ['viridis', 'florens', 'solaris'], // producer
    killer:   ['ferox', 'armata', 'rapax'],    // killer
    armor:    ['testa', 'crusta', 'scutata'],  // armoured
    eye:      ['vigil', 'oculata', 'lucida'],  // sighted
};

const SpeciesNamer = {
    _used: Object.create(null),

    reset() {
        this._used = Object.create(null);
    },

    /**
     * Name for an anatomy. Deterministic in the anatomy's shape, so the same body
     * always yields the same genus — convergent evolution shows up as a name clash,
     * which is informative rather than annoying.
     */
    name(anatomy) {
        if (!anatomy || !anatomy.cells || anatomy.cells.length === 0) {
            return this._unique('Vacua');
        }

        const counts = {};
        for (const c of CellStates.living) counts[c.name] = 0;
        let h = 2166136261;
        for (const cell of anatomy.cells) {
            const n = cell.state ? cell.state.name : 'empty';
            if (counts[n] !== undefined) counts[n]++;
            // fold position and type into a hash so shape affects the name
            h ^= (cell.loc_col * 73856093) ^ (cell.loc_row * 19349663) ^ n.length;
            h = Math.imul(h, 16777619) >>> 0;
        }

        const genus = ONSET[h % ONSET.length] + CODA[(h >>> 7) % CODA.length];

        // dominant cell type (ties broken by the hash, not by iteration order)
        let best = null, bestN = -1;
        for (const k in counts) {
            if (counts[k] > bestN) { bestN = counts[k]; best = k; }
        }
        let name = genus;
        if (best && bestN > 0 && EPITHET[best]) {
            const list = EPITHET[best];
            name += ' ' + list[(h >>> 13) % list.length];
        }
        // size marker: makes a 3-cell and a 30-cell relative distinguishable
        const size = anatomy.cells.length;
        if (size >= 12) name += ' major';
        else if (size <= 2) name += ' minor';

        return this._unique(name);
    },

    _unique(base) {
        if (!this._used[base]) {
            this._used[base] = 1;
            return base;
        }
        // Roman-ish suffix keeps repeats readable: "Velnak edax II"
        const n = ++this._used[base];
        return base + ' ' + this._roman(n);
    },

    _roman(n) {
        const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        if (n > 3999) return String(n);
        let out = '';
        for (const [v, s] of table) {
            while (n >= v) { out += s; n -= v; }
        }
        return out;
    },
};

module.exports = SpeciesNamer;
