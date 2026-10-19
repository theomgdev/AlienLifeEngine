const CellStates = require("../CellStates");
const BodyCell = require("./BodyCell");
const Hyperparams = require("../../../Hyperparameters");
const Directions = require("../../Directions");
const Observation = require("../../Perception/Observation")

class EyeCell extends BodyCell{
    constructor(org, loc_col, loc_row){
        super(CellStates.eye, org, loc_col, loc_row);
        this.org.anatomy.has_eyes = true;
        // Mobility is derived from sight (see Anatomy.checkTypeChange), and the
        // flags are also set here at construction because addRandomizedCell and
        // addDefaultCell build a body without running checkTypeChange. The old
        // MoverCell set is_mover the same way; dropping it from the evolvable pool
        // left every sighted random organism immobile, which starved whole worlds.
        this.org.anatomy.is_mover = true;
    }

    initInherit(parent) {
        // deep copy parent values
        super.initInherit(parent);
        this.direction = parent.direction;
    }
    
    initRandom() {
        // initialize values randomly
        this.direction = Directions.getRandomDirection();
    }

    initDefault() {
        // initialize to default values
        this.direction = Directions.up;
    }

    getAbsoluteDirection() {
        var dir = this.org.rotation + this.direction;
        if (dir > 3)
            dir -= 4;
        return dir;
    }

    performFunction() {
        // Every eye's report is kept: SensoryVector feeds all of them to the brain
        // together, so a body with more eyes genuinely perceives more.
        this.org.observations.push(this.look());
    }

    look() {
        var env = this.org.env;
        var direction = this.getAbsoluteDirection();
        var addCol = 0;
        var addRow = 0;
        switch(direction) {
            case Directions.up:
                addRow = -1;
                break;
            case Directions.down:
                addRow = 1;
                break;
            case Directions.right:
                addCol = 1;
                break;
            case Directions.left:
                addCol = -1;
                break;
        }
        var start_col = this.getRealCol();
        var start_row = this.getRealRow();
        var col = start_col;
        var row = start_row;
        var grid = env.grid_map;
        var empty_id = CellStates.empty.id;
        var see_through_self = Hyperparams.seeThroughSelf;
        // The square the ray is standing on when it stops, or null if it walked
        // off the grid. An eye whose sightline runs out of world reports nothing
        // rather than reporting the last open square, which SensoryVector reads
        // as silence -- the same percept as before the mirror existed.
        var last_cell = null;
        for (var i=0; i<Hyperparams.lookRange; i++){
            col+=addCol;
            row+=addRow;
            // The ray walks the state mirror and only reaches for the cell object
            // once something is actually in the way. A sightline is mostly open
            // ground, so this is the difference between one typed-array read per
            // step and a pointer chase per step.
            var id = grid.stateIdAt(col, row);
            if (id < 0) {
                last_cell = null;
                break;
            }
            if (id === empty_id) {
                last_cell = grid.cellAt(col, row);
                continue;
            }
            var cell = grid.cellAt(col, row);
            if (cell.owner === this.org && see_through_self) {
                last_cell = cell;
                continue;
            }
            var distance = Math.abs(start_col-col) + Math.abs(start_row-row);
            return new Observation(cell, distance, direction);
        }
        return new Observation(last_cell, Hyperparams.lookRange, direction);
    }
}

module.exports = EyeCell;