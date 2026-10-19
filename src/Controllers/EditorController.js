const CanvasController = require("./CanvasController");
const Modes = require("./ControlModes");
const CellStates = require("../Organism/Cell/CellStates");
const Directions = require("../Organism/Directions");
const Hyperparams = require("../Hyperparameters");
const Species = require("../Stats/Species");
const LoadController = require("./LoadController");
const FossilRecord = require("../Stats/FossilRecord");
const MindViewer = require("../Rendering/MindViewer");
const { brainSigmaFor } = require("../Organism/Perception/BrainShape");

class EditorController extends CanvasController{
    constructor(env, canvas) {
        super(env, canvas);
        this.mode = Modes.None;
        this.edit_cell_type = null;
        this.highlight_org = false;
        this.mind_viewer = new MindViewer('mind-host');
        this.defineCellTypeSelection();
        this.defineEditorDetails();
        this.defineSaveLoad();
    }

    mouseMove() {
        if (this.right_click || this.left_click)
            this.editOrganism();
    }

    mouseDown() {
        this.editOrganism();
    }

    mouseUp(){}

    getCurLocalCell(){
        return this.env.organism.anatomy.getLocalCell(this.mouse_c-this.env.organism.c, this.mouse_r-this.env.organism.r);
    }

    /**
     * Clicking the workbench IS the request to draw on it.
     *
     * Mode is global across both canvases, so a tool chosen for the world (food,
     * walls, select) leaves the workbench inert and a click there does nothing
     * at all. Reaching for the grid is unambiguous though -- the workbench has
     * no other use -- so the click switches to Draw and lands, instead of being
     * discarded while the user looks for what they did wrong.
     */
    claimDrawMode() {
        if (this.mode === Modes.Edit) return true;
        const cp = this.control_panel;
        if (!cp || !cp.setMode) return false;
        cp.setMode(Modes.Edit);
        // Keep the dock in step: setMode moves the controllers, the button
        // highlight lives in the panel's own click handler.
        $('.edit-mode-btn').removeClass('selected');
        $('.edit').addClass('selected');
        return this.mode === Modes.Edit;
    }

    editOrganism() {
        if (!this.claimDrawMode())
            return;
        if (this.edit_cell_type == null) {
            // Nothing to draw with: say so where the user is looking rather
            // than swallowing the click.
            this.flashPalettePrompt();
            return;
        }
        if (this.left_click){
            if(this.edit_cell_type == CellStates.eye && this.cur_cell.state == CellStates.eye) {
                var loc_cell = this.getCurLocalCell();
                loc_cell.direction = Directions.rotateRight(loc_cell.direction);
                this.env.renderFull();
            }
            else
                this.env.addCellToOrg(this.mouse_c, this.mouse_r, this.edit_cell_type);
        }
        else if (this.right_click)
            this.env.removeCellFromOrg(this.mouse_c, this.mouse_r);

        // Opening the panel is not enough: the brain readout and the mind canvas
        // are only written by setBrainDetails, so adding the eye that reveals the
        // panel would otherwise leave it blank until some other path refreshed it.
        if (this.setBrainPanelVisibility()) {
            this.setBrainDetails();
        }
        this.setMoveRangeVisibility();
        this.updateDetails();
    }

    /**
     * Draw a tissue the user has not picked one for: point at the palette.
     *
     * The class drives a CSS animation and is removed on its own animationend,
     * so repeated clicks keep re-triggering it rather than firing once and
     * leaving the element permanently marked.
     */
    flashPalettePrompt() {
        const palette = document.getElementById('cell-selections');
        if (!palette) return;
        palette.classList.remove('palette-prompt');
        // Reading offsetWidth forces the style flush that lets the same
        // animation restart on consecutive clicks.
        void palette.offsetWidth;
        palette.classList.add('palette-prompt');
    }

    updateDetails() {
        $('.species-name').text("Species name: "+this.env.organism.species.name);
        $('.cell-count').text("Cell count: "+this.env.organism.anatomy.cells.length);
        if (this.env.organism.isNatural()){
            $('#unnatural-org-warning').css('display', 'none');
        }
        else {
            $('#unnatural-org-warning').css('display', 'block');
        }
    }

    defineCellTypeSelection() {
        var self = this;
        $('.cell-type').click( function() {
            switch(this.id){
                case "mouth":
                    self.edit_cell_type = CellStates.mouth;
                    break;
                case "producer":
                    self.edit_cell_type = CellStates.producer;
                    break;
                case "killer":
                    self.edit_cell_type = CellStates.killer;
                    break;
                case "armor":
                    self.edit_cell_type = CellStates.armor;
                    break;
                case "eye":
                    self.edit_cell_type = CellStates.eye;
                    break;
            }
            $(".cell-type" ).removeClass("selected-cell-type");
            $('#'+this.id+'.cell-type').addClass("selected-cell-type");
            // Picking a tissue is the other half of the same intent: the next
            // click is going to be on the grid, so arm Draw now rather than
            // letting that click be the one that discovers the wrong mode.
            self.claimDrawMode();
        });
    }

    defineEditorDetails() {
        this.details_html = $('#organism-details');
        this.edit_details_html = $('#edit-organism-details');

        this.decision_names = ["ignore", "move away", "move towards"];

        $('#species-name-edit').on('focusout', function() {
            const new_name = $('#species-name-edit').val();
            if (new_name === '' || new_name === this.env.organism.species.name)
                return;
            FossilRecord.changeSpeciesName(this.env.organism.species, new_name);
        }.bind(this));

        $('#move-range-edit').change ( function() {
            this.env.organism.move_range = parseInt($('#move-range-edit').val());
        }.bind(this));
		
        $('#mutation-rate-edit').change ( function() {
            this.env.organism.mutability = parseInt($('#mutation-rate-edit').val());
        }.bind(this));
    }

    defineSaveLoad() {
        $('#save-org').click(()=>{
            let org = this.env.organism.serialize();
            let data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(org));
            let downloadEl = document.getElementById('download-el');
            downloadEl.setAttribute("href", data);
            const name = this.env.organism.species.name ? this.env.organism.species.name : "organism";
            downloadEl.setAttribute("download", name+".json");
            downloadEl.click();
        });
        $('#load-org').click(() => {
            LoadController.loadJson((org)=>{
                this.loadOrg(org);
            });
        });
    }

    loadOrg(org) {
        this.env.clear();
        this.env.organism.loadRaw(org);
        this.refreshDetailsPanel();
        this.env.organism.updateGrid();
        this.env.renderFull();
        this.env.organism.species = new Species(this.env.organism.anatomy, null, 0);
        if (org.species_name)
            this.env.organism.species.name = org.species_name;
        if (this.mode === Modes.Clone)
            $('#drop-org').click();
    }

    clearDetailsPanel() {
        $('#organism-details').css('display', 'none');
        $('#edit-organism-details').css('display', 'none');
        $('#randomize-organism-details').css('display', 'none');
    }

    refreshDetailsPanel() {
        if (this.mode === Modes.Edit)
            this.setEditorPanel();
        else
            this.setDetailsPanel();

    }

    setDetailsPanel() {
        this.clearDetailsPanel();
        var org = this.env.organism;
        
        this.updateDetails();
        $('#move-range').text("Move Range: "+org.move_range);
        $('#mutation-rate').text("Mutation Rate: "+org.mutability);
       
		if (Hyperparams.useGlobalMutability) {
            $('#mutation-rate').css('display', 'none');
            $('#brain-coupling').css('display', 'none');
        }
        else {
            $('#mutation-rate').css('display', 'block');
            // Only meaningful for a brain, and only while the rate is evolving:
            // under a fixed rate the manual sigma is used and the ratio is idle.
            if (org.anatomy.has_eyes) {
                $('#brain-coupling').text(`Brain Coupling: ${org.brain_coupling.toFixed(2)}x`
                    + ` (sigma ${brainSigmaFor(org.mutability, org.brain_coupling).toFixed(3)})`);
                $('#brain-coupling').css('display', 'block');
            } else {
                $('#brain-coupling').css('display', 'none');
            }
        }

        this.setMoveRangeVisibility();

        if (this.setBrainPanelVisibility()) {
            this.setBrainDetails();

        }
        $('#organism-details').css('display', 'block');
    }

    setEditorPanel() {
        this.clearDetailsPanel();
        var org = this.env.organism;

        $('#species-name-edit').val(org.species.name);
        $('.cell-count').text("Cell count: "+org.anatomy.cells.length);
        if (this.setMoveRangeVisibility()){
            $('#move-range-edit').val(org.move_range);
        }

		$('#mutation-rate-edit').val(org.mutability);
        if (Hyperparams.useGlobalMutability) {
			$('#mutation-rate-cont').css('display', 'none');
        }
        else {
            $('#mutation-rate-cont').css('display', 'block');
        }
        
        $('#cell-selections').css('display', 'grid');
        $('#edit-organism-details').css('display', 'block');
    }

    setBrainPanelVisibility() {
        var org = this.env.organism;
        if (org.anatomy.has_eyes) {
            $('.brain-details').css('display', 'block');
            return true;
        }
        $('.brain-details').css('display', 'none');
        return false;
    }

    setBrainDetails() {
        const org = this.env.organism;
        const brain = org ? org.brain : null;
        if (!brain || !brain.inspect) {
            $('.chase-types').text("Blind — no brain.");
            $('.retreat-types').text("");
            if (this.mind_viewer) this.mind_viewer.clear();
            return;
        }
        const info = brain.inspect();
        if (info) {
            $('.chase-types').text(
                `Neural brain: ${info.N}x${info.N} (${info.shared_n} shared / ${info.private_n} private)`);
            $('.retreat-types').text(
                `RMSNorm gain: ${Number.isFinite(info.gain) ? info.gain.toFixed(3) : 'unavailable'}`);
            if (this.mind_viewer) this.mind_viewer.render(info);
        } else {
            $('.chase-types').text("Blind — no brain.");
            $('.retreat-types').text("");
            if (this.mind_viewer) this.mind_viewer.clear();
        }
    }

    setMoveRangeVisibility() {
        var org = this.env.organism;
        if (org.anatomy.is_mover) {
            $('#move-range-cont').css('display', 'block');
            $('#move-range').css('display', 'block');
            return true;
        }
        $('#move-range-cont').css('display', 'none');
        $('#move-range').css('display', 'none');
        return false;
    }

    setRandomizePanel() {
        this.clearDetailsPanel();
        $('#randomize-organism-details').css('display', 'block');
    }
}

module.exports = EditorController;
