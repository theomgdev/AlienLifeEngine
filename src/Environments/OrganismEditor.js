const Environment = require('./Environment');
const Organism = require('../Organism/Organism');
const GridMap = require('../Grid/GridMap');
const Renderer = require('../Rendering/Renderer');
const CellStates = require('../Organism/Cell/CellStates');
const EditorController = require("../Controllers/EditorController");
const Species = require('../Stats/Species');
const RNG = require("../Utils/RNG");
const RandomOrganismGenerator = require('../Organism/RandomOrganismGenerator')

const BrainArena = require('../Organism/Perception/BrainArena');
const { clampBrainShape } = require('../Organism/Perception/BrainShape');
const Hyperparams = require('../Hyperparameters');

class OrganismEditor extends Environment{
    constructor() {
        super();
        this.is_active = true;
        var cell_size = 13;
        // The editor needs an arena so the organism sitting on the workbench has
        // somewhere to hold its brain weights. 4 slots is plenty for one workbench.
        // Same gate as the world: the workbench must build brains of exactly the
        // shape the world runs, or an organism dropped from here would not fit.
        const shape = clampBrainShape(Hyperparams.brainN, Hyperparams.brainSharedFrac);
        this.brain_shape = shape;
        this.brain_arena = new BrainArena(4, shape.N, shape.shared_n, shape.sense_n, shape.action_n);
        this.grid_map = new GridMap(15, 15, cell_size);
        this.renderer = new Renderer('editor-canvas', 'editor-env', cell_size);
        this.renderer.fillShape(195, 195);
        this.controller = new EditorController(this, this.renderer.canvas);
        this.setDefaultOrg();
    }

    update() {
        if (this.is_active){
            this.renderer.renderHighlights();
        }
    }

    changeCell(c, r, state, owner) {
        super.changeCell(c, r, state, owner);
        this.renderFull();
    }

    renderFull() {
        this.renderer.renderFullGrid(this.grid_map.grid);
        // Draw subtle grid lines on the editor workbench
        const ctx = this.renderer.ctx;
        if (ctx) {
            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1;
            const cs = this.grid_map.cell_size;
            for (let x = 0; x <= this.grid_map.cols; x++) {
                ctx.beginPath();
                ctx.moveTo(x * cs + 0.5, 0);
                ctx.lineTo(x * cs + 0.5, this.grid_map.rows * cs);
                ctx.stroke();
            }
            for (let y = 0; y <= this.grid_map.rows; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * cs + 0.5);
                ctx.lineTo(this.grid_map.cols * cs, y * cs + 0.5);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // absolute c r, not local
    addCellToOrg(c, r, state) {
        var center = this.grid_map.getCenter();
        var loc_c = c - center[0];
        var loc_r = r - center[1];
        var prev_cell = this.organism.anatomy.getLocalCell(loc_c, loc_r)
        if (prev_cell != null) {
            var new_cell = this.organism.anatomy.replaceCell(state, prev_cell.loc_col, prev_cell.loc_row, false);
            this.changeCell(c, r, state, new_cell);
        }
        else if (this.organism.anatomy.canAddCellAt(loc_c, loc_r)){
            this.changeCell(c, r, state, this.organism.anatomy.addDefaultCell(state, loc_c, loc_r));
        }
        this.organism.species = new Species(this.organism.anatomy, null, 0);
    }

    removeCellFromOrg(c, r) {
        var center = this.grid_map.getCenter();
        var loc_c = c - center[0];
        var loc_r = r - center[1];
        if (loc_c == 0 && loc_r == 0){
            alert("Cannot remove center cell");
            return;
        }
        var prev_cell = this.organism.anatomy.getLocalCell(loc_c, loc_r)
        if (prev_cell != null) {
            if (this.organism.anatomy.removeCell(loc_c, loc_r)) {
                this.changeCell(c, r, CellStates.empty, null);
                this.organism.species = new Species(this.organism.anatomy, null, 0);
            }
        }
    }

    setOrganismToCopyOf(orig_org) {
        if (this.organism && this.organism.brain && this.organism.brain.detach) {
            this.organism.brain.detach();
        }
        this.grid_map.fillGrid(CellStates.empty);
        var center = this.grid_map.getCenter();
        this.organism = new Organism(center[0], center[1], this, orig_org);
        this.organism.updateGrid();
        this.renderFull();
        this.controller.updateDetails();
    }
    
    getCopyOfOrg() {
        var new_org = new Organism(0, 0, null, this.organism);
        return new_org;
    }

    clear() {
        this.grid_map.fillGrid(CellStates.empty);
        this.renderFull();
    }

    setDefaultOrg() {
        if (this.organism && this.organism.brain && this.organism.brain.detach) {
            this.organism.brain.detach();
        }
        this.clear();
        var center = this.grid_map.getCenter();
        this.organism = new Organism(center[0], center[1], this, null);
        this.organism.anatomy.addDefaultCell(CellStates.mouth, 0, 0);
        this.organism.updateGrid();
        this.organism.species = new Species(this.organism.anatomy, null, 0);
        this.renderFull();
    }

    createRandom() {
        this.grid_map.fillGrid(CellStates.empty);

        this.organism = RandomOrganismGenerator.generate(this);
        this.organism.updateGrid();
        this.organism.species = new Species(this.organism.anatomy, null, 0);
        this.renderFull();
    }

    resetWithRandomOrgs(env) {
        let reset_confirmed = env.reset(true, false);
        if (!reset_confirmed) return;
        let numOrganisms = parseInt($('#num-random-orgs').val());

        let size = Math.ceil(8);

        for (let i=0; i<numOrganisms; i++) {
            let newOrganism = RandomOrganismGenerator.generate(this);
            newOrganism.species = new Species(newOrganism.anatomy, null, 0);
            var col = Math.floor(size + (RNG.random() * (env.grid_map.cols-(size*2)) ) );
            var row = Math.floor(size + (RNG.random() * (env.grid_map.rows-(size*2)) ) );
            env.controller.dropOrganism(newOrganism, col, row);
        }
    }
}

module.exports = OrganismEditor;