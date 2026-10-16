const Neighbors = require("./Grid/Neighbors");

const Hyperparams = {
    setDefaults: function() {
        this.lifespanMultiplier = 100;
        this.foodProdProb = 5;
        this.killableNeighbors = Neighbors.adjacent;
        this.edibleNeighbors = Neighbors.adjacent;
        this.growableNeighbors = Neighbors.adjacent;

        this.useGlobalMutability = false;
        this.globalMutability = 10;
        this.addProb = 33;
        this.changeProb = 33;
        this.removeProb = 33;
        
        this.rotationEnabled = true;

        this.foodBlocksReproduction = true;
        // Sight is not free: a sighted body produces food at this fraction of a
        // blind producer's rate. 0 means an eye switches food production off
        // entirely, so a thinking lineage must feed itself by finding and eating
        // plants rather than photosynthesising on the spot.
        //
        // An earlier sweep put this at 0.75 because thinkers were dying out, but
        // that sweep predates eye-driven movement: it measured brains that could
        // not reliably steer. With movement bound to sight, observed play shows
        // sighted lineages learning to graze on producer colonies and surviving
        // at 0 — so the subsidy is no longer needed and the harder, more
        // interesting ecology is the default.
        this.sightedProducerRate = 0;

        this.instaKill = false;

        this.lookRange = 20;
        // Eyes see through their own body by default. Blocking self-sight walls a
        // mutation in as soon as a cell lands in front of an eye, which penalises
        // exactly the elaborate bodies evolution should be free to explore.
        this.seeThroughSelf = true;

        // Free food falling from nowhere. Also predates eye-driven movement: it
        // existed to keep brittle worlds alive. Sighted grazers now sustain
        // themselves off producers, and a trickle of free food mainly rewards
        // sitting still, so the default is off.
        this.foodDropProb = 0;

        // Extra food a sighted (and therefore mobile, thinking) organism must
        // collect before it can reproduce. The price of a mind.
        this.sightedFoodCost = 0;

        this.maxOrganisms = -1;

        // --- AlienLifeEngine: hive-mind brain ---
        // Every sighted organism carries an NxN fully connected recurrent brain.
        // brainSharedFrac of its state vector is shared through the CollectiveField
        // with every other thinking organism in the same region; the rest is private.
        // All of it evolves by mutation alone.
        this.brainN = 16;              // 272 params/organism; 5.8% of a 60fps frame at 2000 organisms
        // The collective slice. Observed in play: at 0.25 minds act alone; at 0.5
        // they still move autonomously but a herd signal emerges on top of it —
        // populations drift together toward food-rich regions. That migration
        // behaviour is the whole point of the shared field, so 0.5 is the default.
        this.brainSharedFrac = 0.5;
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