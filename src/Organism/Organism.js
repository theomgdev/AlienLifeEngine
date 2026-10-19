const CellStates = require("./Cell/CellStates");
const Neighbors = require("../Grid/Neighbors");
const Hyperparams = require("../Hyperparameters");
const Directions = require("./Directions");
const Anatomy = require("./Anatomy");
const NeuralBrain = require("./Perception/NeuralBrain");
const SensoryVector = require("./Perception/SensoryVector");
const FossilRecord = require("../Stats/FossilRecord");
const SerializeHelper = require("../Utils/SerializeHelper");
const RNG = require("../Utils/RNG");

class Organism {
    constructor(col, row, env, parent=null) {
        this.c = col;
        this.r = row;
        this.env = env;
        this.lifetime = 0;
        this.food_collected = 0;
        this.living = true;
        this.anatomy = new Anatomy(this)
        this.direction = Directions.down; // direction of movement
        this.rotation = Directions.up; // direction of rotation
        this.can_rotate = Hyperparams.rotationEnabled;
        this.move_count = 0;
        this.move_range = 4;
        this.mutability = 15;
        this.damage = 0;
        // Every organism carries a brain. It only gets used once the body has an
        // eye, but it is inherited unconditionally so a lineage that loses its
        // eyes and regains them later keeps the mind it evolved.
        this.observations = [];
        this.brain = new NeuralBrain(this);
        if (env && env.brain_arena) {
            this.brain.attach(env.brain_arena, env.collective_field);
        }
        if (parent != null) {
            this.inherit(parent);
        }
    }

    inherit(parent) {
        this.move_range = parent.move_range;
        this.mutability = parent.mutability;
        this.species = parent.species;
        for (var c of parent.anatomy.cells){
            //deep copy parent cells
            this.anatomy.addInheritCell(c);
        }
        this.brain.copy(parent.brain);
    }

    // amount of food required before it can reproduce
    foodNeeded() {
        return this.anatomy.cells.length + (this.anatomy.has_eyes ? Hyperparams.sightedFoodCost : 0);
    }

    lifespan() {
        return this.anatomy.cells.length * Hyperparams.lifespanMultiplier;
    }

    maxHealth() {
        return this.anatomy.cells.length;
    }

    reproduce() {
        //produce mutated child
        //check nearby locations (is there room and a direct path)
        var org = new Organism(0, 0, this.env, this);
        if(Hyperparams.rotationEnabled){
            org.rotation = Directions.getRandomDirection();
        }
        var prob = this.mutability;
        if (Hyperparams.useGlobalMutability){
            prob = Hyperparams.globalMutability;
        }
        else {
            //mutate the mutability
            if (RNG.random() <= 0.5)
                org.mutability++;
            else{ 
                org.mutability--;
                if (org.mutability < 1)
                    org.mutability = 1;
            }
        } 
        var mutated = false;
        if (RNG.random() * 100 <= prob) {
            // Brain and body mutate together on every mutation event, so the mind
            // is always under selection rather than on a rare side-branch.
            org.brain.mutate();
            if (org.anatomy.is_mover && RNG.random() * 100 <= 10) {
                org.move_range += Math.floor(RNG.random() * 4) - 2;
                if (org.move_range <= 0) org.move_range = 1;
            }
            {
                mutated = org.mutate();
            }
        }

        var direction = Directions.getRandomScalar();
        var direction_c = direction[0];
        var direction_r = direction[1];
        var offset = (Math.floor(RNG.random() * 3));
        var basemovement = this.anatomy.birth_distance;
        var new_c = this.c + (direction_c*basemovement) + (direction_c*offset);
        var new_r = this.r + (direction_r*basemovement) + (direction_r*offset);

        if (org.isClear(new_c, new_r, org.rotation, true) && 
            org.isStraightPath(new_c, new_r, this.c, this.r, this) && 
            this.env.canAddOrganism())
        {
            org.c = new_c;
            org.r = new_r;
            this.env.addOrganism(org);
            org.updateGrid();
            if (mutated) {
                FossilRecord.addSpecies(org, this.species);
            }
            else {
                org.species.addPop();
            }
        }
        else if (org.brain && org.brain.detach) {
            // Birth failed (no room, or blocked path). The child was never added to
            // the world and will never die, so its arena slot has to be handed back
            // here or the weight pool leaks one slot per failed birth — and with a
            // measured ~78% failure rate that exhausts the arena in minutes.
            org.brain.detach();
        }
        Math.max(this.food_collected -= this.foodNeeded(), 0);
    }

    mutate() {
        let added = false;
        let changed = false;
        let removed = false;
        if (this.calcRandomChance(Hyperparams.addProb)) {
            let branch = this.anatomy.getRandomCell();
            let state = CellStates.getRandomLivingType();//branch.state;
            let growth_direction = Neighbors.all[Math.floor(RNG.random() * Neighbors.all.length)]
            let c = branch.loc_col+growth_direction[0];
            let r = branch.loc_row+growth_direction[1];
            if (this.anatomy.canAddCellAt(c, r)){
                added = true;
                this.anatomy.addRandomizedCell(state, c, r);
            }
        }
        if (this.calcRandomChance(Hyperparams.changeProb)){
            let cell = this.anatomy.getRandomCell();
            let state = CellStates.getRandomLivingType();
            this.anatomy.replaceCell(state, cell.loc_col, cell.loc_row);
            changed = true;
        }
        if (this.calcRandomChance(Hyperparams.removeProb)){
            if(this.anatomy.cells.length > 1) {
                let cell = this.anatomy.getRandomCell();
                removed = this.anatomy.removeCell(cell.loc_col, cell.loc_row);
            }
        }
        return added || changed || removed;
    }

    calcRandomChance(prob) {
        return (RNG.random() * 100) < prob;
    }

    /**
     * Step one cell along the current heading.
     * @param reverse  travel opposite the heading without turning the body —
     *                 backing out of a dead end instead of spending two ticks
     *                 turning around while still facing the thing it fled.
     */
    attemptMove(reverse = false) {
        var direction = Directions.scalars[this.direction];
        var sign = reverse ? -1 : 1;
        var direction_c = direction[0] * sign;
        var direction_r = direction[1] * sign;
        var new_c = this.c + direction_c;
        var new_r = this.r + direction_r;
        if (this.isClear(new_c, new_r)) {
            for (var cell of this.anatomy.cells) {
                var real_c = this.c + cell.rotatedCol(this.rotation);
                var real_r = this.r + cell.rotatedRow(this.rotation);
                this.env.changeCell(real_c, real_r, CellStates.empty, null);
            }
            this.c = new_c;
            this.r = new_r;
            this.updateGrid();
            return true;
        }
        return false;
    }

    attemptRotate() {
        if(!this.can_rotate){
            this.direction = Directions.getRandomDirection();
            this.move_count = 0;
            return true;
        }
        var new_rotation = Directions.getRandomDirection();
        if(this.isClear(this.c, this.r, new_rotation)){
            for (var cell of this.anatomy.cells) {
                var real_c = this.c + cell.rotatedCol(this.rotation);
                var real_r = this.r + cell.rotatedRow(this.rotation);
                this.env.changeCell(real_c, real_r, CellStates.empty, null);
            }
            this.rotation = new_rotation;
            this.direction = Directions.getRandomDirection();
            this.updateGrid();
            this.move_count = 0;
            return true;
        }
        return false;
    }

    /**
     * Rotate the body to a chosen orientation, taking its eyes with it.
     *
     * Separate from attemptRotate(), which exists as the stuck-detection
     * fallback and deliberately randomises both rotation and heading. This one
     * is a decision: it changes nothing but the orientation, so a brain can aim
     * its eyes without also scrambling where it was going.
     *
     * Returns false when the rotated body would not fit — a long creature in a
     * corridor genuinely cannot turn, which is a real cost of that body plan and
     * exactly the kind of pressure that should shape geometry.
     */
    attemptRotateTo(new_rotation) {
        if (!this.can_rotate) return false;
        if (new_rotation === this.rotation) return true;
        if (!this.isClear(this.c, this.r, new_rotation)) return false;
        for (var cell of this.anatomy.cells) {
            var real_c = this.c + cell.rotatedCol(this.rotation);
            var real_r = this.r + cell.rotatedRow(this.rotation);
            this.env.changeCell(real_c, real_r, CellStates.empty, null);
        }
        this.rotation = new_rotation;
        this.updateGrid();
        return true;
    }

    changeDirection(dir) {
        this.direction = dir;
        this.move_count = 0;
    }

    // assumes either c1==c2 or r1==r2, returns true if there is a clear path from point 1 to 2
    isStraightPath(c1, r1, c2, r2, parent){
        if (c1 == c2) {
            if (r1 > r2){
                var temp = r2;
                r2 = r1;
                r1 = temp;
            }
            for (var i=r1; i!=r2; i++) {
                var cell = this.env.grid_map.cellAt(c1, i)
                if (!this.isPassableCell(cell, parent)){
                    return false;
                }
            }
            return true;
        }
        else {
            if (c1 > c2){
                var temp = c2;
                c2 = c1;
                c1 = temp;
            }
            for (var i=c1; i!=c2; i++) {
                var cell = this.env.grid_map.cellAt(i, r1);
                if (!this.isPassableCell(cell, parent)){
                    return false;
                }
            }
            return true;
        }
    }

    isPassableCell(cell, parent){
        return cell != null && (cell.state == CellStates.empty || cell.owner == this || cell.owner == parent || cell.state == CellStates.food);
    }

    isClear(col, row, rotation=this.rotation) {
        for(var loccell of this.anatomy.cells) {
            var cell = this.getRealCell(loccell, col, row, rotation);
            if (cell==null) {
                return false;
            }
            if (cell.owner==this || cell.state==CellStates.empty || (!Hyperparams.foodBlocksReproduction && cell.state==CellStates.food)){
                continue;
            }
            return false;
        }
        return true;
    }

    harm() {
        this.damage++;
        if (this.damage >= this.maxHealth() || Hyperparams.instaKill) {
            this.die();
        }
    }

    die() {
        for (var cell of this.anatomy.cells) {
            var real_c = this.c + cell.rotatedCol(this.rotation);
            var real_r = this.r + cell.rotatedRow(this.rotation);
            this.env.changeCell(real_c, real_r, CellStates.food, null);
        }
        if (this.species)
            this.species.decreasePop();
        // Hand the brain's arena slot back so a few thousand deaths per second
        // don't leak the weight pool.
        if (this.brain && this.brain.detach)
            this.brain.detach();
        this.living = false;
    }

    updateGrid() {
        for (var cell of this.anatomy.cells) {
            var real_c = this.c + cell.rotatedCol(this.rotation);
            var real_r = this.r + cell.rotatedRow(this.rotation);
            this.env.changeCell(real_c, real_r, cell.state, cell);
        }
    }

    update() {
        this.lifetime++;
        if (this.lifetime > this.lifespan()) {
            this.die();
            return this.living;
        }
        if (this.food_collected >= this.foodNeeded()) {
            this.reproduce();
        }
        this.observations.length = 0;
        for (var cell of this.anatomy.cells) {
            cell.performFunction();
            if (!this.living)
                return this.living
        }
        
        // Movement is sight's doing: is_mover is true exactly when the body has an
        // eye, so everything that moves also thinks, and the payoff of mobility is
        // the payoff of the brain.
        if (this.anatomy.is_mover) {
            this.move_count++;
            const senses = SensoryVector.build(this, this.observations);
            const intent = this.brain.think(senses);

            // A halt is a decision, not a failure to decide: the body stays put,
            // the brain keeps running, and none of the stuck-detection fallback
            // fires. Without this a creature that wanted to sit still would be
            // rotated away by the "didn't move" branch below every single tick.
            if (intent === NeuralBrain.INTENT_HALT) {
                this.move_count = 0;
                return this.living;
            }

            // A body turn is also a decision and costs the tick's movement: the
            // creature spends the step aiming its eyes instead of travelling.
            // That tradeoff is the point — it is what makes a good line of sight
            // worth evolving a body geometry for.
            if (intent === NeuralBrain.INTENT_TURN_L || intent === NeuralBrain.INTENT_TURN_R) {
                const turned = intent === NeuralBrain.INTENT_TURN_L
                    ? Directions.rotateLeft(this.rotation)
                    : Directions.rotateRight(this.rotation);
                if (this.attemptRotateTo(turned)) {
                    this.move_count = 0;
                    return this.living;
                }
                // Blocked: it wanted to turn and the geometry refused. Fall
                // through and spend the tick attempting the move instead — there
                // is no rescue to reach, so this is the creature's own problem.
            }

            // No random fallback when a move or turn fails, so the move result is
            // not inspected. The stuck-detection that used to sit here fired on
            // 33.3% of all decisions (29.8% from blocked movement, 3.4% from a
            // move_range timeout) and replaced the brain's chosen action with a
            // random rotation and heading, so the network never saw the
            // consequence of walking into a wall — only a random jump. The
            // timeout half was worse than useless: it punished a deliberate
            // "hold course", which is now its own action channel.
            //
            // That rescue was right for the old stateless lookup-table brain,
            // which could lock onto a wall forever. A recurrent net has memory
            // plus halt, reverse and two body turns, so escaping is its own job,
            // and a lineage whose brain cannot manage it is meant to die.
            // Measured in Research/harness/ux_probe/fallback_attribution.js
            if (intent === NeuralBrain.INTENT_REVERSE) this.attemptMove(true);
            else this.attemptMove();
        }
        return this.living;
    }

    getRealCell(local_cell, c=this.c, r=this.r, rotation=this.rotation){
        var real_c = c + local_cell.rotatedCol(rotation);
        var real_r = r + local_cell.rotatedRow(rotation);
        return this.env.grid_map.cellAt(real_c, real_r);
    }

    isNatural() {
        let found_center = false;
        if (this.anatomy.cells.length === 0) {
            return false;
        }
        for (let i=0; i<this.anatomy.cells.length; i++) {
            let cell = this.anatomy.cells[i];
            for (let j=i+1; j<this.anatomy.cells.length; j++) {
                let toCompare = this.anatomy.cells[j];
                if (cell.loc_col === toCompare.loc_col && cell.loc_row === toCompare.loc_row) {
                    return false;
                }
            }
            if (cell.loc_col === 0 && cell.loc_row === 0) {
                found_center = true;
            }
        }
        return found_center;
    }

    serialize() {
        let org = SerializeHelper.copyNonObjects(this);
        delete org.observations;
        org.anatomy = this.anatomy.serialize();
        let b = this.brain.serialize();
        if (b) org.brain = b;
        org.species_name = this.species ? this.species.name : undefined;
        return org;
    }

    loadRaw(org) {
        SerializeHelper.overwriteNonObjects(org, this);
        this.observations = [];
        this.anatomy.loadRaw(org.anatomy)
        if (org.brain) this.brain.loadRaw(org.brain);
    }

}

module.exports = Organism;
