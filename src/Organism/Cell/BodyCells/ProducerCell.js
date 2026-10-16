const CellStates = require("../CellStates");
const BodyCell = require("./BodyCell");
const Hyperparams = require("../../../Hyperparameters");
const RNG = require("../../../Utils/RNG");

class ProducerCell extends BodyCell{
    constructor(org, loc_col, loc_row){
        super(CellStates.producer, org, loc_col, loc_row);
        this.org.anatomy.is_producer = true;
    }

    performFunction() {
        // A sighted body still produces food, just more slowly. Switching
        // production off entirely for anything with an eye (as the original engine
        // did for movers) makes sight disqualifying and starves out every thinking
        // lineage — measured: thinkers collapsed to 1-3 individuals within 40k ticks.
        var env = this.org.env;
        var prob = Hyperparams.foodProdProb;
        if (this.org.anatomy.has_eyes)
            prob *= Hyperparams.sightedProducerRate;
        var real_c = this.getRealCol();
        var real_r = this.getRealRow();
        if (RNG.random() * 100 <= prob) {
            var loc = Hyperparams.growableNeighbors[Math.floor(RNG.random() * Hyperparams.growableNeighbors.length)]
            var loc_c=loc[0];
            var loc_r=loc[1];
            var cell = env.grid_map.cellAt(real_c+loc_c, real_r+loc_r);
            if (cell != null && cell.state == CellStates.empty){
                env.changeCell(real_c+loc_c, real_r+loc_r, CellStates.food, null);
                return;
            }
        }
    }
}

module.exports = ProducerCell;
