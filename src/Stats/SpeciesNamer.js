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

// Size is a third name, Latin and ordered, rather than a bare major/minor pair.
// The old code appended "major" at >=12 cells and "minor" at <=2, which left
// everything from 3 to 11 cells — most of the population — with no size word at
// all, and made a 12-cell and a 60-cell body read identically.
const SIZE_WORDS = [
    [3,        'nana'],     // 1-2 cells, dwarf
    [6,        'parva'],    // 3-5
    [12,       'media'],    // 6-11
    [24,       'magna'],    // 12-23
    [Infinity, 'maxima'],   // 24+
];

// How much a tissue says about what a creature *is*. Mouth cells are near
// universal, so their presence is uninformative; an eye or a killer cell is a
// strong statement about a body's strategy. Without this weighting the plain
// cell-count maximum names most of the biosphere "edax".
const TISSUE_SALIENCE = {
    mouth:    1.0,
    producer: 1.6,
    armor:    2.0,
    eye:      2.6,
    killer:   3.0,
};

// A name gains a subspecies word rather than an ever-growing numeral.
const ROMAN_LIMIT = 8;
const SUBSPECIES = [
    'borealis', 'australis', 'orientalis', 'occidentalis', 'litoralis',
    'montana', 'palustris', 'silvestris', 'campestris', 'abyssalis',
    'gregaria', 'solitaria', 'nomas', 'sedentaria', 'profunda',
];

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

        // Species epithet from the body's speciality, not its bulk tissue.
        //
        // Mouth cells are the commonest tissue in almost every body, so a plain
        // cell-count maximum named most of the biosphere "edax" and the epithet
        // stopped carrying information. Score is salience x sqrt(count): the
        // square root keeps abundance meaningful while stopping it from drowning
        // a rare, diagnostic tissue, so one killer cell among six mouths still
        // reads as a predator — which is what a taxonomist would call it.
        let best = null, bestScore = -1;
        for (const k in counts) {
            if (counts[k] === 0 || !EPITHET[k]) continue;
            const score = (TISSUE_SALIENCE[k] || 1) * Math.sqrt(counts[k]);
            if (score > bestScore) { bestScore = score; best = k; }
        }

        let name = genus;
        if (best) {
            const list = EPITHET[best];
            name += ' ' + list[(h >>> 13) % list.length];
        }

        // Size as an ordered Latin third name across the whole range.
        const size = anatomy.cells.length;
        for (const [limit, word] of SIZE_WORDS) {
            if (size < limit) { name += ' ' + word; break; }
        }

        return this._unique(name);
    },

    _unique(base) {
        if (!this._used[base]) {
            this._used[base] = 1;
            return base;
        }
        const n = ++this._used[base];
        return base + ' ' + this._suffix(base, n);
    },

    /**
     * Distinguish a repeat of an existing name.
     *
     * Real taxonomy never writes "edax XLII": past a handful of varieties a
     * binomial gains a third name, not a tally. So the first few repeats take
     * Roman numerals (II, III, IV — which reads like a variety), and beyond that
     * the organism gets a subspecies word drawn from the clash count. The old
     * code had neither: its numeral table stopped at X, so the 42nd clash
     * rendered as forty-two consecutive X's — the "Zanoth edax minor
     * XXXXXXXX...II" that showed up in play.
     *
     * The cycle numeral must NOT wrap. `cycle % ROMAN_LIMIT` looked like it kept
     * names short, but it made the 144th clash of a genus reproduce the name of
     * its 9th exactly ("borealis II" twice). Since extinct_species is keyed by
     * name, a duplicate silently overwrote an older fossil and the record
     * stopped growing — a long run quietly lost dynasties instead of keeping
     * them. Beyond the words the suffix just counts, which is honest and rare.
     */
    _suffix(base, n) {
        if (n <= ROMAN_LIMIT) return this._roman(n);
        const i = n - ROMAN_LIMIT - 1;
        const word = SUBSPECIES[i % SUBSPECIES.length];
        const cycle = Math.floor(i / SUBSPECIES.length);
        return cycle === 0 ? word : word + ' ' + this._roman(cycle + 1);
    },

    _roman(n) {
        // Full table. The previous one stopped at X, so any n above ~12 degenerated
        // into a run of X's instead of C/L/D/M.
        const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
                       [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
                       [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        if (n > 3999 || n < 1) return String(n);
        let out = '';
        for (const [v, s] of table) {
            while (n >= v) { out += s; n -= v; }
        }
        return out;
    },
};

module.exports = SpeciesNamer;
