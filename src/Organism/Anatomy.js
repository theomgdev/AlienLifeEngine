const CellStates = require("./Cell/CellStates");
const BodyCellFactory = require("./Cell/BodyCells/BodyCellFactory");
const SerializeHelper = require("../Utils/SerializeHelper");
const RNG = require("../Utils/RNG");

class Anatomy {
    constructor(owner) {
        this.owner = owner;
        this.birth_distance = 4;
        this.clear();
    }

    clear() {
        this.cells = [];
        this.is_producer = false;
        this.is_mover = false;
        this.has_eyes = false;
    }

    canAddCellAt(c, r) {
        for (var cell of this.cells) {
            if (cell.loc_col == c && cell.loc_row == r){
                return false;
            }
        }
        return true;
    }

    addDefaultCell(state, c, r) {
        var new_cell = BodyCellFactory.createDefault(this.owner, state, c, r);
        this.cells.push(new_cell);
        return new_cell;
    }

    addRandomizedCell(state, c, r) {
        if (state==CellStates.eye && !this.has_eyes) {
            // The legacy table brain seeded random decisions when eyes first
            // appeared. The neural brain has no decision table — its weights are
            // already randomised at birth and shaped by evolution from there.
            if (this.owner.brain && this.owner.brain.randomizeDecisions)
                this.owner.brain.randomizeDecisions();
        }
        var new_cell = BodyCellFactory.createRandom(this.owner, state, c, r);
        this.cells.push(new_cell);
        return new_cell;
    }

    addInheritCell(parent_cell) {
        var new_cell = BodyCellFactory.createInherited(this.owner, parent_cell);
        this.cells.push(new_cell);
        return new_cell;
    }

    replaceCell(state, c, r, randomize=true) {
        this.removeCell(c, r, true);
        if (randomize) {
            return this.addRandomizedCell(state, c, r);
        }
        else {
            return this.addDefaultCell(state, c, r);
        }
    }

    removeCell(c, r, allow_center_removal=false) {
        if (c == 0 && r == 0 && !allow_center_removal)
            return false;
        for (var i=0; i<this.cells.length; i++) {
            var cell = this.cells[i];
            if (cell.loc_col == c && cell.loc_row == r){
                this.cells.splice(i, 1);
                break;
            }
        }
        this.checkTypeChange();
        return true;
    }

    getLocalCell(c, r) {
        for (var cell of this.cells) {
            if (cell.loc_col == c && cell.loc_row == r){
                return cell;
            }
        }
        return null;
    }

    checkTypeChange() {
        this.is_producer = false;
        this.has_eyes = false;
        for (var cell of this.cells) {
            if (cell.state == CellStates.producer)
                this.is_producer = true;
            if (cell.state == CellStates.eye)
                this.has_eyes = true;
        }
        // Mobility is a consequence of sight, not a separate organ.
        //
        // With a dedicated mover cell, blind organisms could move on random
        // directions and competed against sighted ones on equal footing — so the
        // eye's cost was paid up front while its benefit (a brain worth consulting)
        // only arrived later, and thinking lineages measurably never got off the
        // ground: peaks of ~50 thinkers decaying to 1-3 individuals within 40k ticks.
        //
        // Deriving movement from the eye fuses the two: everything that moves sees,
        // everything that sees thinks, and the evolutionary payoff of mobility IS
        // the payoff of the brain. There is no blind random-walker to compete with.
        this.is_mover = this.has_eyes;
    }

    getRandomCell() {
        return this.cells[Math.floor(RNG.random() * this.cells.length)];
    }

    getNeighborsOfCell(col, row) {
        var neighbors = [];
        for (var x = -1; x <= 1; x++) {
            for (var y = -1; y <= 1; y++) {

                var neighbor = this.getLocalCell(col + x, row + y);
                if (neighbor)
                    neighbors.push(neighbor)
            }
        }

        return neighbors;
    }

    isEqual(anatomy) { // currently unused helper func. inefficient, avoid usage in prod.
        if (this.cells.length !== anatomy.cells.length) return false;
        for (let i in this.cells) {
            let my_cell = this.cells[i];
            let their_cell = anatomy.cells[i];
            if (my_cell.loc_col !== their_cell.loc_col ||
                my_cell.loc_row !== their_cell.loc_row ||
                my_cell.state !== their_cell.state)
                return false;
        }
        return true;
    }

    serialize() {
        let anatomy = SerializeHelper.copyNonObjects(this);
        anatomy.cells = [];
        for (let cell of this.cells) {
            let newcell = SerializeHelper.copyNonObjects(cell);
            newcell.state = {name: cell.state.name};
            anatomy.cells.push(newcell)
        }
        return anatomy;
    }

    loadRaw(anatomy) {
        this.clear();
        for (let cell of anatomy.cells){
            this.addInheritCell(cell);
        }
    }
}

module.exports = Anatomy;