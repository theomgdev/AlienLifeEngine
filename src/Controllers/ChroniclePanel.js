// ChroniclePanel — renders the Chronicle tab: event log, lineage, dynasties.
//
// Updates on a timer rather than per tick: the DOM is the slowest thing in the
// engine, and at 300 ticks/frame a per-tick innerHTML rebuild would cost more than
// the simulation itself. The chronicle sets a `dirty` flag when something happens,
// so a quiet world costs nothing at all.

const FossilRecord = require("../Stats/FossilRecord");
const Chronicle = require("../Narrative/Chronicle");

const ICON = {
    genesis:    'fa-seedling',
    first:      'fa-star',
    mind:       'fa-brain',
    culture:    'fa-share-alt',
    bottleneck: 'fa-compress-arrows-alt',
    famine:     'fa-arrow-down',
    boom:       'fa-arrow-up',
    dynasty:    'fa-monument',
    apocalypse: 'fa-skull-crossbones',
    record:     'fa-trophy',
};

class ChroniclePanel {
    constructor(engine) {
        this.engine = engine;
        this.open = false;
        this.last_count = -1;
        $('#chronicle.tabnav-item').click(() => { this.open = true; this.refresh(true); });
        // leaving the tab stops the work entirely
        $('.tabnav-item').click((e) => {
            if (e.currentTarget && e.currentTarget.id !== 'chronicle') this.open = false;
        });
        this.timer = setInterval(() => this.refresh(), 900);
    }

    get chronicle() { return this.engine.env.chronicle; }

    refresh(force = false) {
        const c = this.chronicle;
        if (!c || !this.open) return;
        if (!force && !c.dirty && c.entries.length === this.last_count) return;
        c.dirty = false;
        this.last_count = c.entries.length;
        this.renderLog(c);
        this.renderLineage();
        this.renderDynasties();
    }

    renderLog(c) {
        if (c.entries.length === 0) {
            $('#chronicle-log').html("<p class='chronicle-empty'>Nothing has happened yet.</p>");
            return;
        }
        const rows = [];
        // newest first: the interesting thing is almost always the latest
        for (let i = c.entries.length - 1; i >= 0; i--) {
            const e = c.entries[i];
            const icon = ICON[e.kind] || 'fa-circle';
            rows.push(
                `<div class='chron-row chron-${e.kind}'>` +
                `<i class='fa ${icon} chron-icon'></i>` +
                `<span class='chron-tick'>${e.tick.toLocaleString()}</span>` +
                `<span class='chron-text'>${this.escape(e.text)}</span>` +
                `</div>`);
        }
        $('#chronicle-log').html(rows.join(''));
    }

    renderLineage() {
        let deepest = null, maxGen = -1;
        for (const s of Object.values(FossilRecord.extant_species)) {
            if ((s.generation || 0) > maxGen) { maxGen = s.generation; deepest = s; }
        }
        if (!deepest) {
            $('#lineage-sub').text('');
            $('#lineage-tree').html("<p class='chronicle-empty'>No living species.</p>");
            return;
        }
        const chain = FossilRecord.lineageOf(deepest);
        $('#lineage-sub').text(
            `${chain.length} generation${chain.length === 1 ? '' : 's'} of ancestry still traceable.`);
        // root at the top, so it reads as descent
        const rows = chain.slice().reverse().map((n, i) => {
            const alive = n.end_tick === -1;
            return `<div class='lin-row${alive ? ' lin-alive' : ''}' style='padding-left:${i * 11}px'>` +
                   `<span class='lin-branch'>${i === 0 ? '' : '└ '}</span>` +
                   `<span class='lin-name'>${this.escape(n.name)}</span>` +
                   `<span class='lin-gen'>g${n.generation}</span>` +
                   `</div>`;
        });
        $('#lineage-tree').html(rows.join(''));
    }

    renderDynasties() {
        const dead = Object.values(FossilRecord.extinct_species)
            .sort((a, b) => b.cumulative_pop - a.cumulative_pop)
            .slice(0, 12);
        if (dead.length === 0) {
            $('#dynasty-list').html("<p class='chronicle-empty'>No extinct lineages recorded yet.</p>");
            return;
        }
        const rows = dead.map(s => {
            const life = s.end_tick - s.start_tick;
            return `<div class='dyn-row'>` +
                   `<span class='dyn-name'>${this.escape(s.name)}</span>` +
                   `<span class='dyn-stat'>${s.cumulative_pop.toLocaleString()} born</span>` +
                   `<span class='dyn-stat'>${life.toLocaleString()} ticks</span>` +
                   `</div>`;
        });
        $('#dynasty-list').html(rows.join(''));
    }

    escape(s) {
        return String(s).replace(/[&<>"]/g, ch =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    }
}

module.exports = ChroniclePanel;
