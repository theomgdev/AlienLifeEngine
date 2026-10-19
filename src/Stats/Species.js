const CellStates = require("../Organism/Cell/CellStates");
const RNG = require("../Utils/RNG");
const SpeciesNamer = require("./SpeciesNamer");
let FossilRecord = undefined; // workaround to a circular dependency problem
const getFossilRecord = () => {
    if (!FossilRecord)
        FossilRecord = require("./FossilRecord");
    return FossilRecord;
}

let next_species_id = 1;

class Species {
    constructor(anatomy, ancestor, start_tick) {
        this.anatomy = anatomy;
        // Phylogeny is kept as an ID, not an object reference. Holding the ancestor
        // Species itself forces nulling it out on extinction, which severs the tree
        // after 2-3 generations and makes a 400k-tick history unreadable. An id is
        // 4 bytes and survives the ancestor's death, so the full tree stays
        // recoverable.
        this.id = next_species_id++;
        this.ancestor_id = ancestor ? ancestor.id : null;
        this.generation = ancestor ? (ancestor.generation || 0) + 1 : 0;
        this.ancestor = ancestor;   // kept only while the ancestor is extant
        this.population = 1;
        this.cumulative_pop = 1;
        this.peak_pop = 1;
        this.start_tick = start_tick;
        this.end_tick = -1;
        this.name = SpeciesNamer.name(anatomy);
        this.extinct = false;
        this.calcAnatomyDetails();
    }

    calcAnatomyDetails() {
        if (!this.anatomy) return;
        var cell_counts = {};
        for (let c of CellStates.living) {
            cell_counts[c.name] = 0;
        }
        for (let cell of this.anatomy.cells) {
            cell_counts[cell.state.name]+=1;
        }
        this.cell_counts=cell_counts;
        this.cell_total = this.anatomy.cells.length;
    }

    addPop() {
        this.population++;
        this.cumulative_pop++;
        if (this.population > this.peak_pop) this.peak_pop = this.population;
    }

    decreasePop() {
        this.population--;
        if (this.population <= 0) {
            this.extinct = true;
            getFossilRecord().fossilize(this);
        }
    }

    lifespan() {
        return this.end_tick - this.start_tick;
    }
}

module.exports = Species;