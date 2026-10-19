// SpeciesHover — show a creature's body when the pointer rests on its name.
//
// Lineage and census panels are lists of names, and a name is the one thing
// about a creature that carries no information. Opening each one in the editor
// to see it costs a click, a tab switch and whatever was on the workbench, so
// a deep lineage is never actually looked at. A thumbnail under the cursor
// turns the same list into something you read by moving along it.
//
// Pointer-only. A touch device has no hover to read, and a card that appears on
// tap would fight the tap that opens the species, so the whole feature is left
// unbound there rather than shown and worked around.

const SpeciesLink = require("./SpeciesLink");
const { anatomyOfSpecies } = require("../Stats/FossilAnatomy");
const { renderAnatomy, describeAnatomy } = require("../Rendering/AnatomyThumb");

// Delay before the card appears. Long enough that sweeping the pointer across a
// list does not flash a card per name, short enough to feel immediate when the
// pointer stops.
const HOVER_DELAY_MS = 90;
const EDGE_MARGIN_PX = 12;

const SpeciesHover = {
    /**
     * Bind the hover card, on pointer devices only.
     *
     * Returns false when nothing was bound, so a caller can tell the difference
     * between "not supported here" and "bound and idle".
     */
    init() {
        // A real pointer that can hover. Width would be the wrong question: a
        // touchscreen laptop is wide and still has no hover, and a desktop
        // window narrowed to a phone's width still does.
        if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches)
            return false;

        this.el = document.createElement('div');
        this.el.id = 'species-hover-card';
        this.el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.el);

        // Cache by name: a lineage walked back and forth re-enters the same
        // names, and a body only changes when the species does.
        this.cache = new Map();
        this.timer = null;
        this.current = null;

        // Delegated on the drawer, like SpeciesLink's click: rows are rebuilt on
        // a timer and must not need rebinding.
        $('.drawer-body')
            .on('mouseenter', '.species-link', (e) => this.schedule(e.currentTarget))
            .on('mouseleave', '.species-link', () => this.hide())
            // A click opens the editor, where the card would be left floating
            // over the new tab.
            .on('click', '.species-link', () => this.hide());

        // The drawer scrolls under a card that is positioned against the
        // viewport, which would leave it pointing at the wrong row.
        $('.drawer-body').on('scroll', () => this.hide());
        return true;
    },

    schedule(anchor) {
        this.cancel();
        this.timer = setTimeout(() => this.show(anchor), HOVER_DELAY_MS);
    },

    cancel() {
        if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    },

    /** Thumbnail for a name: {url, label} or null when there is no body. */
    cardFor(name) {
        const species = SpeciesLink.lookup(name);
        if (!species) return null;

        // Keyed on the species' identity, not its name: a name can be edited in
        // the inspector or revised by the namer while the body is unchanged, and
        // a name-keyed cache would then answer with another creature's picture.
        const key = species.id !== undefined ? species.id : name;
        if (this.cache.has(key)) return this.cache.get(key);

        const anatomy = anatomyOfSpecies(species);
        const thumb = anatomy ? renderAnatomy(anatomy) : null;
        if (!thumb) { this.cache.set(key, null); return null; }

        const info = describeAnatomy(anatomy);
        const bits = [`${info.total} cell${info.total === 1 ? '' : 's'}`];
        bits.push(info.thinking ? `${info.eyes} eye${info.eyes === 1 ? '' : 's'}` : 'blind');
        if (species.extinct) bits.push('extinct');

        // The drawn size travels with the URL so the <img> can be given its
        // dimensions up front. Without them the card is measured before the
        // image contributes any height, and positioning against that smaller
        // box lets the finished card hang off the bottom of the viewport.
        const card = {
            url: thumb.url, label: bits.join(' \u00b7 '),
            width: thumb.width, height: thumb.height,
        };
        this.cache.set(key, card);
        return card;
    },

    show(anchor) {
        const name = anchor.getAttribute('data-species');
        if (!name) return;
        const card = this.cardFor(name);
        if (!card) return;

        // Built through the DOM rather than innerHTML: a species name is
        // user-editable text, and assigning it as markup would make the rename
        // field an injection point.
        this.el.textContent = '';
        const img = document.createElement('img');
        img.src = card.url;
        img.alt = '';
        img.className = 'hover-anatomy';
        // Intrinsic size, so the card has its final height before it is measured.
        img.width = card.width;
        img.height = card.height;
        const meta = document.createElement('div');
        meta.className = 'hover-meta';
        const name_el = document.createElement('span');
        name_el.className = 'hover-name';
        name_el.textContent = name;
        const stats_el = document.createElement('span');
        stats_el.className = 'hover-stats';
        stats_el.textContent = card.label;
        meta.appendChild(name_el);
        meta.appendChild(stats_el);
        this.el.appendChild(img);
        this.el.appendChild(meta);

        this.el.classList.add('visible');
        this.current = name;
        this.position(anchor);
    },

    /**
     * Place the card beside the name, flipping rather than overflowing.
     *
     * The card is measured after its content is in and its layout has been
     * forced: the body's aspect decides the card's size, so positioning against
     * a stale or zero height lets a tall card run off a short viewport.
     */
    position(anchor) {
        const r = anchor.getBoundingClientRect();
        const card = this.el.getBoundingClientRect();
        const w = card.width;
        const h = card.height;

        let left = r.right + EDGE_MARGIN_PX;
        if (left + w > window.innerWidth - EDGE_MARGIN_PX)
            left = r.left - w - EDGE_MARGIN_PX;
        if (left < EDGE_MARGIN_PX) left = EDGE_MARGIN_PX;

        // Centre on the name, then pull inside the viewport. Clamping the
        // bottom before the top matters on a short window: the bottom edge is
        // the one a tall card crosses, and the top clamp must win if both
        // constraints cannot hold.
        let top = r.top + r.height / 2 - h / 2;
        if (top + h > window.innerHeight - EDGE_MARGIN_PX)
            top = window.innerHeight - h - EDGE_MARGIN_PX;
        if (top < EDGE_MARGIN_PX) top = EDGE_MARGIN_PX;

        this.el.style.left = `${Math.round(left)}px`;
        this.el.style.top = `${Math.round(top)}px`;
    },

    hide() {
        this.cancel();
        if (!this.el) return;
        this.el.classList.remove('visible');
        this.current = null;
    },
};

module.exports = SpeciesHover;
