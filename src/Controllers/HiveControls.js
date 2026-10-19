// HiveControls — wires every Hive Mind control in the UI to the engine.
//
// Kept out of ControlPanel.js deliberately: that file is already a 536-line god
// object, and the hive is the one feature most likely to grow more knobs. It owns
// the hotbar toggle, the Evolution Controls section and the hotkey, so there is
// exactly one place to look when the collective misbehaves.

const WorldConfig = require("../WorldConfig");
const Hyperparams = require("../Hyperparameters");
const { BRAIN_LIMITS, clampBrainShape, clampFieldParams, clampNum } = require('../Organism/Perception/BrainShape');


class HiveControls {
    constructor(engine) {
        this.engine = engine;
        this.defineOverlayToggle();
        this.defineHiveParams();
        this.loadValuesFromParams();
    }

    get env() { return this.engine.env; }

    // ---- overlay ---------------------------------------------------------

    setOverlay(on) {
        WorldConfig.show_collective_field = !!on;
        const renderer = this.env.renderer;
        if (on) {
            // Pick up the current zoom right away: zooming while paused fires no
            // render tick, so the overlay would otherwise sit at a stale scale.
            if (renderer.syncOverlayTransform) renderer.syncOverlayTransform();
        } else if (renderer.clearCollectiveOverlay) {
            renderer.clearCollectiveOverlay();
        }
        this.syncUI();
    }

    toggleOverlay() {
        this.setOverlay(!WorldConfig.show_collective_field);
    }

    defineOverlayToggle() {
        $('#hive-toggle').click(() => this.toggleOverlay());
        $('#hive-overlay').change(() => this.setOverlay($('#hive-overlay').is(':checked')));
    }

    syncUI() {
        const on = WorldConfig.show_collective_field;
        $('#hive-overlay').prop('checked', on);
        if (on) $('#hive-toggle').addClass('active');
        else $('#hive-toggle').removeClass('active');
    }

    // ---- hive hyperparameters -------------------------------------------

    defineHiveParams() {
        // Brain shape changes require a fresh arena: existing organisms hold slots
        // sized for the old N, so the hive is rebuilt and the world restarted.
        // Every input goes through clampBrainShape so an impossible geometry can
        // never reach the engine, and whatever the clamp changed is reported back
        // to the user instead of being applied silently.
        $('#brain-size').change(() => {
            this.applyShape(parseInt($('#brain-size').val()), Hyperparams.brainSharedFrac);
        });
        $('#shared-frac').change(() => {
            this.applyShape(Hyperparams.brainN, parseFloat($('#shared-frac').val()));
        });

        // These are live: the field can be reshaped without touching brains.
        $('#collective-radius').change(() => {
            const f = clampFieldParams(parseInt($('#collective-radius').val()),
                Hyperparams.collectiveLeak, Hyperparams.collectiveTileSize);
            Hyperparams.collectiveRadius = f.radius;
            $('#collective-radius').val(f.radius);
            this.report(f.adjusted);
            const fld = this.env.collective_field;
            if (fld) fld.resize(fld.cols, fld.rows, Hyperparams.collectiveTileSize, undefined, f.radius);
        });
        $('#collective-leak').change(() => {
            const f = clampFieldParams(Hyperparams.collectiveRadius,
                parseFloat($('#collective-leak').val()), Hyperparams.collectiveTileSize);
            Hyperparams.collectiveLeak = f.leak;
            $('#collective-leak').val(f.leak);
            this.report(f.adjusted);
            if (this.env.collective_field) this.env.collective_field.leak = f.leak;
        });
        $('#brain-mutation').change(() => {
            const L = BRAIN_LIMITS;
            const s = clampNum(parseFloat($('#brain-mutation').val()),
                L.MUT_SIGMA_MIN, L.MUT_SIGMA_MAX, 0.08);
            Hyperparams.brainMutationSigma = s.value;
            $('#brain-mutation').val(s.value);
            if (s.changed) this.report([`Brain mutation rate ${s.reason}; using ${s.value}.`]);
        });
        $('#random-start').change(() => {
            Hyperparams.randomStart = $('#random-start').is(':checked');
        });
    }

    /**
     * Validate a requested brain geometry, tell the user what was adjusted, then
     * rebuild the hive if it really changed. Refusing the restart restores the
     * inputs to the values actually in force.
     */
    applyShape(N, frac) {
        const shape = clampBrainShape(N, frac);
        const sameN = shape.N === Hyperparams.brainN;
        const sameShared = shape.shared_n === (this.env.brain_arena ? this.env.brain_arena.shared_n : -1);

        this.report(shape.adjusted);

        if (sameN && sameShared) {
            // Nothing the engine cares about changed (e.g. 0.49 vs 0.5 at N=16
            // both give 8 shared channels). Keep the stored value, skip the
            // restart, and show the user the value that is actually in force.
            Hyperparams.brainSharedFrac = shape.frac;
            this.loadValuesFromParams();
            return false;
        }

        if (!confirm(`Changing brain shape to ${shape.N} channels `
            + `(${shape.shared_n} collective / ${shape.private_n} private, `
            + `${shape.params} evolvable parameters) restarts the world. Proceed?`)) {
            this.loadValuesFromParams();
            return false;
        }

        Hyperparams.brainN = shape.N;
        Hyperparams.brainSharedFrac = shape.frac;
        this.env.initHiveMind();
        this.rebuildEditorArena();
        this.env.reset(false, true);
        this.loadValuesFromParams();
        return true;
    }

    /**
     * Rebuild the workbench arena alongside the world's.
     *
     * The editor holds its own arena, and a brain only copies between arenas of
     * identical shape. Leaving the workbench on the old shape makes inspecting a
     * creature show zeroed weights and the workbench's geometry rather than the
     * creature's, so the two must be rebuilt together.
     */
    rebuildEditorArena() {
        const editor = this.engine ? this.engine.organism_editor : null;
        if (!editor || !editor.initHiveMind) return;
        if (editor.initHiveMind() && editor.setDefaultOrg) {
            // The organism on the bench lost its slot with the old arena; a
            // fresh default body is the only state guaranteed to be valid.
            editor.setDefaultOrg();
        }
    }

    /** Surface clamp decisions to the user. Silence would be the real bug. */
    report(messages) {
        const el = $('#hive-notice');
        if (this._noticeTimer) { clearTimeout(this._noticeTimer); this._noticeTimer = null; }
        if (!messages || messages.length === 0) {
            // An accepted value must clear a stale warning, or the last complaint
            // sits on screen next to a readout that contradicts it.
            el.removeClass('visible').text('');
            return;
        }
        if (el.length) {
            el.text(messages.join(' ')).addClass('visible');
            this._noticeTimer = setTimeout(() => el.removeClass('visible'), 8000);
        } else {
            alert(messages.join('\n'));
        }
    }

    /**
     * Apply a brain geometry that arrived from a file (preset or saved world)
     * rather than from a user gesture.
     *
     * Unlike applyShape() this never asks for confirmation: the user already
     * chose to load the file, and a second prompt mid-load would leave
     * Hyperparams and the running arena disagreeing. It still clamps, still
     * reports, and only rebuilds when the shape actually differs.
     */
    applyLoadedParams() {
        const shape = clampBrainShape(Hyperparams.brainN, Hyperparams.brainSharedFrac);
        const field = clampFieldParams(
            Hyperparams.collectiveRadius, Hyperparams.collectiveLeak, Hyperparams.collectiveTileSize);

        Hyperparams.brainN = shape.N;
        Hyperparams.brainSharedFrac = shape.frac;
        Hyperparams.collectiveRadius = field.radius;
        Hyperparams.collectiveLeak = field.leak;
        Hyperparams.collectiveTileSize = field.tile_size;

        const sigma = clampNum(Hyperparams.brainMutationSigma,
            BRAIN_LIMITS.MUT_SIGMA_MIN, BRAIN_LIMITS.MUT_SIGMA_MAX, 0.08);
        Hyperparams.brainMutationSigma = sigma.value;

        const notes = shape.adjusted.concat(field.adjusted);
        if (sigma.changed) notes.push(`Brain mutation rate ${sigma.reason}; using ${sigma.value}.`);

        const arena = this.env.brain_arena;
        const shapeChanged = !arena || arena.N !== shape.N || arena.shared_n !== shape.shared_n;

        if (shapeChanged) {
            this.env.initHiveMind();
            this.rebuildEditorArena();
            this.env.reset(false, true);
            notes.push(`Loaded brain shape ${shape.N} channels (${shape.shared_n} collective); world restarted.`);
        } else {
            const fld = this.env.collective_field;
            if (fld) {
                fld.leak = field.leak;
                fld.resize(fld.cols, fld.rows, field.tile_size, undefined, field.radius);
            }
        }

        this.report(notes);
        this.loadValuesFromParams();
        return shape;
    }

    /** Rebuild arena + field and restart life, since brain shape changed. */
    rebuildHive() {
        return this.applyShape(Hyperparams.brainN, Hyperparams.brainSharedFrac);
    }

    /** Push current Hyperparams back into the inputs (after a cancel or a load). */
    loadValuesFromParams() {
        const arena = this.env.brain_arena;
        $('#brain-size').val(Hyperparams.brainN);
        $('#shared-frac').val(Hyperparams.brainSharedFrac);
        $('#collective-radius').val(Hyperparams.collectiveRadius);
        $('#collective-leak').val(Hyperparams.collectiveLeak);
        $('#brain-mutation').val(Hyperparams.brainMutationSigma);
        $('#random-start').prop('checked', Hyperparams.randomStart);
        if (arena) {
            $('#brain-shape-readout').text(
                `${arena.N} channels: ${arena.shared_n} collective / ${arena.private_n} private`
                + ` · ${arena.sense_n} senses · ${arena.action_n} actions · ${arena.paramCount()} parameters`);
        }
        this.syncUI();
    }

}

module.exports = HiveControls;
