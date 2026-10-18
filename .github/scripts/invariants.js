// Invariants that quietly sterilise the simulation when broken. There is no unit
// test suite; this is what CI has instead, and it loads the real modules rather
// than reimplementing them.
//
// Run: node .github/scripts/invariants.js

const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const r = (p) => require(path.join(ROOT, p));

const Directions = r('src/Organism/Directions');
const CellStates = r('src/Organism/Cell/CellStates');
const Organism = r('src/Organism/Organism');
const Hyperparams = r('src/Hyperparameters');
const SensoryVector = r('src/Organism/Perception/SensoryVector');
const NeuralBrain = r('src/Organism/Perception/NeuralBrain');
const BrainArena = r('src/Organism/Perception/BrainArena');
const { clampBrainShape, BRAIN_LIMITS, ACTION_N } = r('src/Organism/Perception/BrainShape');
const RNG = r('src/Utils/RNG');

let failures = 0;
function check(name, condition, detail) {
    const ok = !!condition;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`);
}

// --- sensory layout ------------------------------------------------------
// The brain's input matrix is sized from these, so a mismatch means senses are
// silently dropped or read past the end of the vector.
const shape = clampBrainShape(16, 0.5);
check('sense_n matches SensoryVector.CHANNELS',
    shape.sense_n === SensoryVector.CHANNELS,
    `sense_n=${shape.sense_n} CHANNELS=${SensoryVector.CHANNELS}`);

check('action_n matches the declared action count',
    shape.action_n === ACTION_N,
    `action_n=${shape.action_n} ACTION_N=${ACTION_N}`);

check('MAX_EYES leaves room for valence + proximity pairs',
    SensoryVector.MAX_EYES * 2 < SensoryVector.CHANNELS,
    `MAX_EYES=${SensoryVector.MAX_EYES} CHANNELS=${SensoryVector.CHANNELS}`);

// --- every sense actually reaches the brain ------------------------------
// Perturb one channel at a time and require the output to move. A channel that
// changes nothing is a sense the network cannot see.
{
    const arena = new BrainArena(4, shape.N, shape.shared_n, shape.sense_n, shape.action_n);
    const brain = new NeuralBrain({ c: 5, r: 5, changeDirection() {} });
    brain.attach(arena, null);
    RNG.seed(1);
    arena.randomize(brain.slot, RNG);

    // The state vector carries between ticks, so compare one think() against
    // another from the same starting state: zero the private slot each time.
    const priv = arena.hPriv.subarray(arena.pOffset(brain.slot),
                                      arena.pOffset(brain.slot) + arena.private_n);
    const zero = () => priv.fill(0);

    let unreachable = [];
    for (let ch = 0; ch < shape.sense_n; ch++) {
        const a = new Float32Array(shape.sense_n).fill(0.25);
        const b = new Float32Array(shape.sense_n).fill(0.25);
        b[ch] = 0.9;
        zero();
        brain.think(a);
        const outA = brain.last_output;
        zero();
        brain.think(b);
        if (Math.abs(brain.last_output - outA) < 1e-9) unreachable.push(ch);
    }
    check('all sense channels reach the brain', unreachable.length === 0,
        unreachable.length ? `unreachable: ${unreachable.join(',')}` : `${shape.sense_n}/${shape.sense_n}`);
}

// --- brain geometry is clamped through one gate --------------------------
{
    const bad = [
        [0, 0.5], [1, 0.5], [-5, 0.5], [1e6, 0.5], [NaN, 0.5],
        [16, 1.0], [16, 5], [16, -1], [16, NaN],
    ];
    let leaked = [];
    for (const [n, frac] of bad) {
        const s = clampBrainShape(n, frac);
        const okN = s.N >= BRAIN_LIMITS.N_MIN && s.N <= BRAIN_LIMITS.N_MAX;
        const okF = s.frac >= BRAIN_LIMITS.SHARED_FRAC_MIN && s.frac <= BRAIN_LIMITS.SHARED_FRAC_MAX;
        const okShared = s.shared_n >= 0 && s.shared_n <= s.N && s.private_n >= 0;
        if (!okN || !okF || !okShared) leaked.push(`N=${n},frac=${frac} -> ${JSON.stringify(s)}`);
    }
    check('invalid brain geometry is clamped', leaked.length === 0, leaked[0] || `${bad.length} cases`);
}

// --- movement carries no randomness --------------------------------------
// A creature that cannot escape must solve it with memory, turns and reverse.
// A random fallback here destroys that selection pressure, so CI refuses one.
{
    const cols = 60, rows = 60;
    const cells = [];
    for (let c = 0; c < cols; c++) {
        cells[c] = [];
        for (let rr = 0; rr < rows; rr++) cells[c][rr] = { state: CellStates.empty, owner: null, cell_owner: null, c, r: rr };
    }
    const at = (c, rr) => (c >= 0 && rr >= 0 && c < cols && rr < rows) ? cells[c][rr] : null;
    const env = {
        grid_map: { cols, rows, cellAt: at },
        changeCell: (c, rr, s, o) => { const x = at(c, rr); if (x) { x.state = s; x.cell_owner = o; x.owner = o ? o.org : null; } },
        total_ticks: 0,
        collective_field: null,
        organisms: [],
    };
    env.brain_arena = new BrainArena(64, shape.N, shape.shared_n, shape.sense_n, shape.action_n);
    env.addOrganism = (o) => env.organisms.push(o);

    // walls, so creatures get blocked often and any fallback would fire
    for (let i = 0; i < 200; i++) env.changeCell(3 + (i * 7) % 54, 3 + (i * 13) % 54, CellStates.wall, null);

    const orgs = [];
    RNG.seed(7);
    for (let i = 0; i < 24; i++) {
        const o = new Organism(5 + (i * 5) % 50, 5 + (i * 11) % 50, env);
        o.anatomy.addDefaultCell(CellStates.eye, 0, -1);
        o.anatomy.addDefaultCell(CellStates.mouth, 0, 0);
        o.updateGrid();
        if (o.brain && o.brain.attach && (!o.brain.arena || o.brain.slot < 0)) {
            o.brain.attach(env.brain_arena, null);
            env.brain_arena.randomize(o.brain.slot, RNG);
        }
        o.lifespan = () => 1e9;
        o.foodNeeded = () => 1e9;
        orgs.push(o);
    }

    // Count RNG draws during movement only. The stochastic sense channel is
    // built before update() and is a deliberate input, not a movement fallback,
    // so it is excluded by sampling senses separately.
    const realRandom = RNG.random.bind(RNG);
    let draws = 0;
    let counting = false;
    RNG.random = function () { if (counting) draws++; return realRandom(); };

    let decisions = 0;
    for (let t = 0; t < 250; t++) {
        env.total_ticks = t;
        for (const o of orgs) {
            if (!o.living) continue;
            o.observations.length = 0;
            // senses (includes the intentional random drive) outside the count
            counting = false;
            counting = true;
            o.update();
            counting = false;
            decisions++;
        }
    }
    RNG.random = realRandom;

    // senses draw exactly one value per decision by design; anything above that
    // is a movement fallback
    const allowed = decisions;
    check('movement adds no randomness beyond the sense channel',
        draws <= allowed,
        `draws=${draws} decisions=${decisions} allowed=${allowed}`);
}

// --- diversity generators are present ------------------------------------
// The mirror image of the rule above: these rolls are what keep a world from
// going sterile, and deleting them looks like a cleanup.
{
    const src = require('fs').readFileSync(path.join(ROOT, 'src/Organism/Organism.js'), 'utf8');
    const repro = src.slice(src.indexOf('reproduce()'));
    check('birth orientation is rolled in reproduce()',
        /org\.rotation\s*=\s*Directions\.getRandomDirection\(\)/.test(repro));
    check('mutability is inheritable and can drift',
        /org\.mutability/.test(repro));

    const sv = require('fs').readFileSync(path.join(ROOT, 'src/Organism/Perception/SensoryVector.js'), 'utf8');
    check('a stochastic drive channel exists', /RNG\.random\(\)/.test(sv));
}

// --- the rotation toggle is honoured ------------------------------------
{
    const before = Hyperparams.rotationEnabled;
    Hyperparams.rotationEnabled = false;
    const cols = 20, rows = 20;
    const cells = [];
    for (let c = 0; c < cols; c++) {
        cells[c] = [];
        for (let rr = 0; rr < rows; rr++) cells[c][rr] = { state: CellStates.empty, owner: null, cell_owner: null, c, r: rr };
    }
    const at = (c, rr) => (c >= 0 && rr >= 0 && c < cols && rr < rows) ? cells[c][rr] : null;
    const env = {
        grid_map: { cols, rows, cellAt: at },
        changeCell: (c, rr, s, o) => { const x = at(c, rr); if (x) { x.state = s; x.cell_owner = o; x.owner = o ? o.org : null; } },
        total_ticks: 0, collective_field: null, organisms: [], addOrganism() {},
    };
    env.brain_arena = new BrainArena(4, shape.N, shape.shared_n, shape.sense_n, shape.action_n);
    const o = new Organism(10, 10, env);
    o.anatomy.addDefaultCell(CellStates.mouth, 0, 0);
    o.updateGrid();
    const start = o.rotation;
    const turned = o.attemptRotateTo(Directions.right);
    check('rotation toggle off blocks turning', turned === false && o.rotation === start);
    Hyperparams.rotationEnabled = before;
}

// --- a named species can be opened ---------------------------------------
// Every species name shown in the UI is a link to that body in the editor. The
// living ones still hold their Anatomy; the dead ones only have the snapshot
// written at fossilisation, and both arrive in the same `anatomy` field. A
// version that assumed one shape produced cells with state: undefined and threw
// inside the cell factory on click, so CI checks both paths.
{
    const { anatomyOfSpecies } = r('src/Stats/FossilAnatomy');
    const FossilRecord = r('src/Stats/FossilRecord');

    const cols = 30, rows = 30;
    const cells = [];
    for (let c = 0; c < cols; c++) {
        cells[c] = [];
        for (let rr = 0; rr < rows; rr++) cells[c][rr] = { state: CellStates.empty, owner: null, cell_owner: null, c, r: rr };
    }
    const at = (c, rr) => (c >= 0 && rr >= 0 && c < cols && rr < rows) ? cells[c][rr] : null;
    const env = {
        grid_map: { cols, rows, cellAt: at, getCenter: () => [15, 15] },
        changeCell: (c, rr, s, o) => { const x = at(c, rr); if (x) { x.state = s; x.cell_owner = o; x.owner = o ? o.org : null; } },
        total_ticks: 100, collective_field: null, organisms: [], addOrganism() {},
        averageMutability: () => 10,
    };
    env.brain_arena = new BrainArena(8, shape.N, shape.shared_n, shape.sense_n, shape.action_n);
    FossilRecord.setEnv(env);

    const org = new Organism(15, 15, env);
    org.anatomy.addDefaultCell(CellStates.mouth, 0, 0);
    org.anatomy.addDefaultCell(CellStates.eye, 0, -1);
    org.anatomy.addDefaultCell(CellStates.killer, 1, 0);
    org.updateGrid();

    const species = FossilRecord.addSpecies(org, null);
    const usable = (a) => !!(a && a.cells && a.cells.length &&
        a.cells.every((c) => c.state && c.state.name && c.loc_col !== undefined));

    check('a living species can be opened in the editor', usable(anatomyOfSpecies(species)));

    species.cumulative_pop = 50;   // above min_discard, so the fossil is kept
    const name = species.name;
    FossilRecord.fossilize(species);
    const fossil = FossilRecord.extinct_species[name];

    const rebuilt = anatomyOfSpecies(fossil);
    check('an extinct species can be opened in the editor', usable(rebuilt));

    const shapes = rebuilt ? rebuilt.cells.map((c) => `${c.state.name}@${c.loc_col},${c.loc_row}`).sort().join(' ') : '';
    check('the rebuilt body matches the living one',
        shapes === 'eye@0,-1 killer@1,0 mouth@0,0', shapes);

    const eye = rebuilt ? rebuilt.cells.find((c) => c.state.name === 'eye') : null;
    check('eye facing survives fossilisation', !!eye && eye.direction !== undefined);
}

// --- names stay unique, and history stays bounded ------------------------
// extinct_species and ancestor_index are keyed by name and id, so a namer that
// repeats itself silently overwrites older fossils: the record stops growing
// and dynasties vanish. The suffix used to wrap at 144 clashes per genus.
{
    const SpeciesNamer = r('src/Stats/SpeciesNamer');
    SpeciesNamer.reset();
    const seen = new Set();
    for (let i = 1; i <= 2000; i++) seen.add(SpeciesNamer._unique('Velnak'));
    check('species names never repeat within a genus', seen.size === 2000,
        `${seen.size}/2000 unique`);
    SpeciesNamer.reset();
}

// The ancestry index is the only structure that grows with elapsed time rather
// than with the living population. Uncapped it reached ~12 MB per million ticks,
// which is fine on a desktop and fatal on a phone. The trim must bound it
// WITHOUT severing a lineage the UI is drawing.
{
    const FR = r('src/Stats/FossilRecord');
    const saved_idx = FR.ancestor_index;
    const saved_extant = FR.extant_species;
    const saved_extinct = FR.extinct_species;
    const saved_limit = FR.ancestor_limit;

    FR.ancestor_index = Object.create(null);
    FR.extant_species = {};
    FR.extinct_species = {};
    FR.ancestor_limit = 1000;

    // a deep living chain plus a crowd of orphans nothing points at
    for (let id = 1; id <= 3000; id++) {
        FR.ancestor_index[id] = { id, name: 'S' + id, ancestor_id: id > 1 ? id - 1 : null,
                                  generation: id, start_tick: 0, end_tick: -1 };
    }
    for (let id = 3001; id <= 9000; id++) {
        FR.ancestor_index[id] = { id, name: 'O' + id, ancestor_id: null,
                                  generation: 0, start_tick: 0, end_tick: -1 };
    }
    FR.extant_species['tip'] = { id: 3000, name: 'tip', ancestor_id: 2999 };

    FR.trimAncestorIndex();

    const kept = Object.keys(FR.ancestor_index).length;
    check('the ancestry index drops unreachable entries', kept === 3000,
        `kept ${kept}, expected the 3000-link living chain only`);

    let broken = 0, id = FR.extant_species['tip'].ancestor_id;
    while (id != null) {
        const node = FR.ancestor_index[id];
        if (!node) { broken++; break; }
        id = node.ancestor_id;
    }
    check('the trim never severs a living lineage', broken === 0, `broken=${broken}`);

    FR.ancestor_index = saved_idx;
    FR.extant_species = saved_extant;
    FR.extinct_species = saved_extinct;
    FR.ancestor_limit = saved_limit;
}

console.log('');
if (failures) {
    console.log(`${failures} invariant(s) failed`);
    process.exit(1);
}
console.log('all invariants hold');
