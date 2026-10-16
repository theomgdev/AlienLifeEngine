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
        var cell = null;
        for (var i=0; i<Hyperparams.lookRange; i++){
            col+=addCol;
            row+=addRow;
            cell = env.grid_map.cellAt(col, row);
            if (cell == null) {
                break;
            }
            if (cell.owner === this.org && Hyperparams.seeThroughSelf) {
                continue;
            }
            if (cell.state !== CellStates.empty) {
                var distance = Math.abs(start_col-col) + Math.abs(start_row-row);
                return new Observation(cell, distance, direction);
            }
        }
        return new Observation(cell, Hyperparams.lookRange, direction);
    }
}

module.exports = EyeCell;