// HiveControls — wires every Hive Mind control in the UI to the engine.
//
// Kept out of ControlPanel.js deliberately: that file is already a 536-line god
// object, and the hive is the one feature most likely to grow more knobs. It owns
// the hotbar toggle, the Evolution Controls section, the hotkey and the first-run
// hint, so there is exactly one place to look when the collective misbehaves.

const WorldConfig = require("../WorldConfig");
const Hyperparams = require("../Hyperparameters");

const HINT_KEY = "alien_hive_hint_seen";

class HiveControls {
    constructor(engine) {
        this.engine = engine;
        this.defineOverlayToggle();
        this.defineHiveParams();
        this.defineHint();
        this.syncUI();
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
        this.dismissHint();
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
        $('#brain-size').change(() => {
            const n = Math.max(4, Math.min(48, parseInt($('#brain-size').val()) || 16));
            $('#brain-size').val(n);
            Hyperparams.brainN = n;
            this.rebuildHive();
        });
        $('#shared-frac').change(() => {
            const f = Math.max(0, Math.min(0.9, parseFloat($('#shared-frac').val())));
            $('#shared-frac').val(f);
            Hyperparams.brainSharedFrac = f;
            this.rebuildHive();
        });
        $('#hive-enabled').change(() => {
            Hyperparams.useNeuralBrain = $('#hive-enabled').is(':checked');
            this.rebuildHive();
        });

        // These are live: the field can be reshaped without touching brains.
        $('#collective-radius').change(() => {
            const r = Math.max(2, Math.min(80, parseInt($('#collective-radius').val()) || 20));
            $('#collective-radius').val(r);
            Hyperparams.collectiveRadius = r;
            const f = this.env.collective_field;
            if (f) f.resize(f.cols, f.rows, Hyperparams.collectiveTileSize, undefined, r);
        });
        $('#collective-leak').change(() => {
            const l = Math.max(0, Math.min(0.99, parseFloat($('#collective-leak').val())));
            $('#collective-leak').val(l);
            Hyperparams.collectiveLeak = l;
            if (this.env.collective_field) this.env.collective_field.leak = l;
        });
        $('#brain-mutation').change(() => {
            const s = Math.max(0, Math.min(1, parseFloat($('#brain-mutation').val())));
            $('#brain-mutation').val(s);
            Hyperparams.brainMutationSigma = s;
        });
        $('#random-start').change(() => {
            Hyperparams.randomStart = $('#random-start').is(':checked');
        });
    }

    /** Rebuild arena + field and restart life, since brain shape changed. */
    rebuildHive() {
        if (!confirm('Changing brain shape restarts the world. Proceed?')) {
            this.loadValuesFromParams();
            return;
        }
        this.env.initHiveMind();
        this.env.reset(false, true);
    }

    /** Push current Hyperparams back into the inputs (after a cancel or a load). */
    loadValuesFromParams() {
        $('#brain-size').val(Hyperparams.brainN);
        $('#shared-frac').val(Hyperparams.brainSharedFrac);
        $('#collective-radius').val(Hyperparams.collectiveRadius);
        $('#collective-leak').val(Hyperparams.collectiveLeak);
        $('#brain-mutation').val(Hyperparams.brainMutationSigma);
        $('#hive-enabled').prop('checked', Hyperparams.useNeuralBrain);
        $('#random-start').prop('checked', Hyperparams.randomStart);
        this.syncUI();
    }

    // ---- first-run hint --------------------------------------------------

    defineHint() {
        $('#hive-hint-close').click(() => this.dismissHint(true));
        let seen = false;
        try { seen = window.localStorage.getItem(HINT_KEY) === '1'; } catch (e) { /* private mode */ }
        if (seen) return;
        // Let the world fill in first — a hint over an empty grid means nothing.
        this._hintTimer = setTimeout(() => {
            if (!WorldConfig.show_collective_field) $('#hive-hint').addClass('visible');
        }, 4000);
    }

    dismissHint(permanent = false) {
        if (this._hintTimer) { clearTimeout(this._hintTimer); this._hintTimer = null; }
        $('#hive-hint').removeClass('visible');
        if (permanent) {
            try { window.localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* ignore */ }
        }
    }
}

module.exports = HiveControls;
