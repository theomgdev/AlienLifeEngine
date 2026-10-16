const Neighbors = require("./Grid/Neighbors");

const Hyperparams = {
    setDefaults: function() {
        this.lifespanMultiplier = 100;
        this.foodProdProb = 5;
        this.killableNeighbors = Neighbors.adjacent;
        this.edibleNeighbors = Neighbors.adjacent;
        this.growableNeighbors = Neighbors.adjacent;

        this.useGlobalMutability = false;
        this.globalMutability = 5;
        this.addProb = 33;
        this.changeProb = 33;
        this.removeProb = 33;
        
        this.rotationEnabled = true;

        this.foodBlocksReproduction = true;
        this.moversCanProduce = false;

        this.instaKill = false;

        this.lookRange = 20;
        this.seeThroughSelf = false;

        this.foodDropProb = 0;

        this.extraMoverFoodCost = 0;

        this.maxOrganisms = -1;

        // --- AlienLifeEngine: hive-mind brain ---
        // Every mover+eye organism carries an NxN fully connected recurrent brain.
        // brainSharedFrac of its state vector is shared through the CollectiveField
        // with every other thinking organism in the same region; the rest is private.
        // All of it evolves by mutation alone.
        this.useNeuralBrain = true;
        this.brainN = 16;              // 272 params/organism; 5.8% of a 60fps frame at 2000 organisms
        this.brainSharedFrac = 0.25;   // the 25% collective slice
        this.brainInitScale = 0.6;     // initial weight spread
        this.brainMutationSigma = 0.08;
        this.brainActionThreshold = 0.15;  // below this the brain holds course
        this.collectiveTileSize = 6;   // storage resolution (grid cells per tile)
        this.collectiveRadius = 20;    // influence disc radius in grid cells
        this.collectiveLeak = 0.85;    // field memory; higher = slower-moving culture
        // The original ancestor is mouth + 2 producers: static, no brain. Measured:
        // a mover+eye ancestor DIES before its first birth (it collected 5 food of
        // the 5 needed when it starved), because movers cannot produce food unless
        // moversCanProduce is on, and even then the extra cells raise foodNeeded
        // faster than a wandering body can feed itself. See
        // Research/harness/harness_faz0/ancestor_diagnosis.js
        // Instead the world starts as a random CROWD scaled to its area, which seeds
        // many independent lineages at once — some static producers feeding the
        // ecosystem, some already mobile and sighted, thinking from tick one.
        this.randomStart = true;
        this.maxStartPopulation = 20000;
    },

    loadJsonObj(obj) {
        for (let key in obj) {
            this[key] = obj[key];
        }
    }
}

Hyperparams.setDefaults();

module.exports = Hyperparams;