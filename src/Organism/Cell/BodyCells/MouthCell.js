const CellStates = require("../CellStates");
const BodyCell = require("./BodyCell");
const Hyperparams = require("../../../Hyperparameters");

class MouthCell extends BodyCell{
    constructor(org, loc_col, loc_row){
        super(CellStates.mouth, org, loc_col, loc_row);
    }

    performFunction() {
        var env = this.org.env;
        var grid = env.grid_map;
        var real_c = this.getRealCol();
        var real_r = this.getRealRow();
        // Asked through the grid's state mirror: a mouth checks eight squares
        // every tick and almost all of them hold nothing edible, so the common
        // answer costs one typed-array read and never touches a cell object.
        var food_id = CellStates.food.id;
        for (var loc of Hyperparams.edibleNeighbors){
            var c = real_c + loc[0], r = real_r + loc[1];
            if (grid.stateIdAt(c, r) !== food_id) continue;
            env.changeCell(c, r, CellStates.empty, null);
            this.org.food_collected++;
        }
    }

}

module.exports = MouthCell;