// Chronicle — turns the simulation's own events into a readable history.
//
// The engine already lives through a long story: minds appear, predators evolve,
// regions form cultures, populations crash, whole worlds end. None of it was ever
// stated. 400,000 measured ticks included seven total extinctions that the user
// never saw, because auto_reset quietly restarted the world. Chronicle watches for
// the moments that matter and writes them down.
//
// Detection is deliberately cheap: one sweep every `interval` ticks over data the
// stats layer already computes, plus a few first-occurrence flags. No per-organism
// bookkeeping, so it costs nothing measurable even at thousands of organisms.

const CellStates = require("../Organism/Cell/CellStates");

const KIND = {
    GENESIS:   'genesis',
    FIRST:     'first',       // a cell type appears to stay
    MIND:      'mind',        // thinking organisms arrive / vanish
    CULTURE:   'culture',     // the collective differentiates or homogenises
    BOTTLENECK:'bottleneck',
    FAMINE:    'famine',
    BOOM:      'boom',
    DYNASTY:   'dynasty',     // a long-lived lineage dies
    APOCALYPSE:'apocalypse',  // everything died
    RECORD:    'record',      // new largest organism
};

class Chronicle {
    constructor(env) {
        this.env = env;
        this.entries = [];
        this.limit = 400;
        this.interval = 120;          // ticks between sweeps
        this.seen_cells = {};         // cell type -> true once established
        this.had_minds = false;
        this.peak_pop = 0;
        this.peak_cells = 0;
        this.last_pop = 0;
        this.culture_high = false;
        this.epoch = 1;               // increments on each apocalypse
        this.epoch_base = 0;          // monotonic clock offset across resets
        this._tick_of_last = -1e9;
    }

    reset(keep_history = false) {
        if (!keep_history) this.entries = [];
        this.seen_cells = {};
        this.had_minds = false;
        this.peak_pop = 0;
        this.peak_cells = 0;
        this.culture_high = false;
    }

    /**
     * Monotonic history clock. The world's own tick counter resets to zero when
     * auto_reset restarts life, so raw ticks put post-extinction entries BEFORE
     * older ones in the log. This never goes backwards.
     */
    get now() {
        return this.epoch_base + this.env.total_ticks;
    }

    /**
     * All life has ended. Called from removeOrganisms the moment the population
     * hits zero, BEFORE any restart, so the epoch's real length is still known.
     */
    extinction(final_tick) {
        this.log(KIND.APOCALYPSE,
            `All life has ended after ${final_tick.toLocaleString()} ticks. ` +
            `Epoch ${this.epoch} peaked at ${Math.round(this.peak_pop)} organisms.`);
        this.last_pop = 0;
        this._extinct = true;
    }

    /**
     * Life ended and the world is about to restart. Close the epoch and carry its
     * length into the clock so the next epoch's entries sort after this one.
     */
    endEpoch(final_tick) {
        // extinction() has already logged the ending if life ran out. Only a reset
        // that interrupted living organisms needs announcing here.
        if (!this._extinct && this.last_pop > 0) {
            this.log(KIND.APOCALYPSE,
                `The world was reset after ${final_tick.toLocaleString()} ticks.`);
        }
        this._extinct = false;
        this.epoch_base += final_tick;
        this.epoch++;
        this.reset(true);
        this.last_pop = 0;
    }

    /** Record an entry. `key` throttles repeats of the same kind of news. */
    log(kind, text, key) {
        const tick = this.now;
        if (key) {
            const last = this['_k_' + key] || -1e9;
            if (tick - last < this.interval * 8) return;
            this['_k_' + key] = tick;
        }
        this.entries.push({ tick, kind, text, epoch: this.epoch });
        if (this.entries.length > this.limit) this.entries.shift();
        this.latest = this.entries[this.entries.length - 1];
        this.dirty = true;
    }

    recent(n = 8) {
        return this.entries.slice(-n).reverse();
    }

    genesis(founders) {
        this.log(KIND.GENESIS,
            founders > 1
                ? `Life begins: ${founders} founding organisms scattered across the world.`
                : `Life begins from a single organism.`);
    }

    /** Called every tick by WorldEnvironment; does real work on an interval. */
    observe(FossilRecord) {
        const env = this.env;
        const tick = this.now;
        const pop = env.organisms.length;

        // Extinction is announced from extinction(), called by removeOrganisms at
        // the moment population hits zero — before any restart wipes the clock.
        this.last_pop = pop;

        if (tick - this._tick_of_last < this.interval) return;
        this._tick_of_last = tick;
        if (pop === 0) return;

        // ---- census ------------------------------------------------------
        let thinkers = 0, cells = 0, largest = 0;
        const counts = {};
        for (const c of CellStates.living) counts[c.name] = 0;
        for (const o of env.organisms) {
            const n = o.anatomy.cells.length;
            cells += n;
            if (n > largest) largest = n;
            if (o.anatomy.is_mover && o.anatomy.has_eyes) thinkers++;
            for (const cell of o.anatomy.cells) {
                if (counts[cell.state.name] !== undefined) counts[cell.state.name]++;
            }
        }

        // ---- first appearances -------------------------------------------
        // Require a few copies so a single doomed mutant is not announced as an era.
        const FIRST_TEXT = {
            eye: 'Something can see. The world is being watched.',
            killer: 'The first predator. From now on, life eats life.',
            armor: 'Armour answers the predators.',
            producer: 'Producers appear — life makes its own food.',
            mouth: 'Mouths appear — life consumes.',
        };
        // A random founding crowd already contains every cell type, so announcing
        // them as discoveries during the founding window is a lie. Those are the
        // initial conditions; mark them seen silently and report only what evolution
        // actually produces afterwards.
        const founding = env.total_ticks <= this.interval * 2;
        for (const name in counts) {
            if (this.seen_cells[name] || counts[name] < 3) continue;
            this.seen_cells[name] = true;
            if (FIRST_TEXT[name] && !founding) {
                this.log(KIND.FIRST, `Tick ${env.total_ticks.toLocaleString()} — ${FIRST_TEXT[name]}`);
            }
        }

        // ---- the hive mind -----------------------------------------------
        if (thinkers >= 3 && !this.had_minds) {
            this.had_minds = true;
            this.log(KIND.MIND,
                `Tick ${env.total_ticks.toLocaleString()} — ${thinkers} organisms now think with a shared mind.`);
        } else if (this.had_minds && thinkers === 0) {
            this.had_minds = false;
            this.log(KIND.MIND,
                `Tick ${env.total_ticks.toLocaleString()} — the last thinking organism is gone. The collective falls silent.`,
                'minds_lost');
        }

        const field = env.collective_field;
        if (field && thinkers > 0) {
            const div = field.spatialDivergence();
            if (div > 0.15 && !this.culture_high) {
                this.culture_high = true;
                this.log(KIND.CULTURE,
                    `Tick ${env.total_ticks.toLocaleString()} — the collective has split into distinct regional cultures.`,
                    'culture_split');
            } else if (div < 0.04 && this.culture_high) {
                this.culture_high = false;
                this.log(KIND.CULTURE,
                    `Tick ${env.total_ticks.toLocaleString()} — regional cultures have merged into one mind.`,
                    'culture_merge');
            }
        }

        // ---- population dynamics -----------------------------------------
        // Peak decays slowly, so "a collapse from the peak" means a collapse from a
        // RECENT peak. Without this the founding crowd's size stayed the reference
        // forever and every ordinary dip was reported as the same famine.
        if (pop > this.peak_pop) {
            const prev = this.peak_pop;
            this.peak_pop = pop;
            if (prev > 40 && pop > prev * 1.8) {
                this.log(KIND.BOOM,
                    `Tick ${env.total_ticks.toLocaleString()} — population explodes to ${pop}.`, 'boom');
            }
        } else {
            this.peak_pop = Math.max(pop, this.peak_pop * 0.995);
        }
        if (pop <= 8 && this.peak_pop > 60) {
            this.log(KIND.BOTTLENECK,
                `Tick ${env.total_ticks.toLocaleString()} — life narrows to ${pop} organism${pop === 1 ? '' : 's'}. ` +
                `Everything alive now descends from these.`, 'bottleneck');
        } else if (this.peak_pop > 80 && pop < this.peak_pop * 0.25) {
            this.log(KIND.FAMINE,
                `Tick ${env.total_ticks.toLocaleString()} — a collapse: ${pop} left of a peak of ${Math.round(this.peak_pop)}.`,
                'famine');
        }

        // ---- complexity record -------------------------------------------
        if (largest > this.peak_cells) {
            const prev = this.peak_cells;
            this.peak_cells = largest;
            if (prev >= 6 && largest > prev) {
                this.log(KIND.RECORD,
                    `Tick ${env.total_ticks.toLocaleString()} — a new largest body: ${largest} cells.`, 'record');
            }
        }

        // ---- dynasties ----------------------------------------------------
        if (FossilRecord && FossilRecord.extinct_species) {
            const dead = FossilRecord.extinct_species;
            for (const name in dead) {
                const s = dead[name];
                if (s._announced) continue;
                s._announced = true;
                const life = s.end_tick - s.start_tick;
                if (life > 12000 && s.cumulative_pop > 400) {
                    this.log(KIND.DYNASTY,
                        `${s.name} is extinct after ${life.toLocaleString()} ticks ` +
                        `and ${s.cumulative_pop.toLocaleString()} descendants.`);
                }
            }
        }
    }

    serialize() {
        return { entries: this.entries.slice(-this.limit), epoch: this.epoch, epoch_base: this.epoch_base };
    }

    loadRaw(raw) {
        if (!raw) return;
        this.entries = raw.entries || [];
        this.epoch = raw.epoch || 1;
        this.epoch_base = raw.epoch_base || 0;
    }
}

Chronicle.KIND = KIND;
module.exports = Chronicle;
