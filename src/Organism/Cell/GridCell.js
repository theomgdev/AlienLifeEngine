const CellStates = require("./CellStates");
const Hyperparams = require("../../Hyperparameters");

// A cell exists in a grid map.
class Cell{
    constructor(state, col, row, x, y){
        this.owner = null; // owner organism
        this.cell_owner = null; // specific body cell of the owner organism that occupies this grid cell
        this.grid = null;  // set by GridMap.resize, which also sets index
        this.index = -1;   // row-major position, for the grid's state mirror
        this.setType(state);
        this.col = col;
        this.row = row;
        this.x = x;
        this.y = y;
    }

    setType(state) {
        this.state = state;
        // The grid's typed state mirror is updated here because this is the only
        // place a cell's type changes, which is what keeps the two in step.
        if (this.grid !== null) this.grid.state_ids[this.index] = state.id;
    }
}

module.exports = Cell;
