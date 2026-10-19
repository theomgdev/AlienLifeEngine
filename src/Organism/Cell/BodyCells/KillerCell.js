const CellStates = require("../CellStates");
const BodyCell = require("./BodyCell");
const Hyperparams = require("../../../Hyperparameters");

class KillerCell extends BodyCell{
    constructor(org, loc_col, loc_row){
        super(CellStates.killer, org, loc_col, loc_row);
    }

    performFunction() {
        var env = this.org.env;
        var grid = env.grid_map;
        var c = this.getRealCol();
        var r = this.getRealRow();
        // Screened through the state mirror first. A killer only harms a living
        // body cell that is not armour, and most neighbours are empty ground or
        // food, so the mirror answers the common case without a cell object.
        var empty_id = CellStates.empty.id, food_id = CellStates.food.id;
        var wall_id = CellStates.wall.id, armor_id = CellStates.armor.id;
        for (var loc of Hyperparams.killableNeighbors) {
            var id = grid.stateIdAt(c + loc[0], r + loc[1]);
            if (id < 0 || id === empty_id || id === food_id || id === wall_id || id === armor_id) continue;
            this.killNeighbor(grid.cellAt(c + loc[0], r + loc[1]));
        }
    }

    killNeighbor(n_cell) {
        if(n_cell == null || n_cell.owner == null || n_cell.owner == this.org || !n_cell.owner.living || n_cell.state == CellStates.armor) 
            return;
        var is_hit = n_cell.state == CellStates.killer; // has to be calculated before death
        n_cell.owner.harm();
        if (Hyperparams.instaKill && is_hit) {
            this.org.harm();
        }
    }
}

module.exports = KillerCell;
