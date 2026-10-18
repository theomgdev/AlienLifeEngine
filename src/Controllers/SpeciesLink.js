// SpeciesLink — the one place that turns a species name shown in the UI into
// something clickable, and the one place that opens it.
//
// Names appear in the Chronicle (log text, lineage, dynasties) and in the
// Statistics census. Rendering an anchor is cheap, but doing it per row with a
// bound handler is not: the Chronicle redraws up to 400 entries on a timer, so
// each row would allocate a closure and jQuery would walk the new DOM to attach
// it. Instead rows carry a data-species attribute and ONE delegated handler on
// the drawer reads it — constant cost no matter how long the history grows.

const FossilRecord = require("../Stats/FossilRecord");
const { anatomyOfSpecies } = require("../Stats/FossilAnatomy");

const SpeciesLink = {
    /** Wire the single delegated click handler. Called once, from ControlPanel. */
    init(control_panel) {
        this.control_panel = control_panel;
        // Delegated: bound to a container that always exists, matching links
        // that do not exist yet. Re-rendering the panel never needs rebinding.
        $('.drawer-body').on('click', '.species-link', (e) => {
            e.preventDefault();
            const name = e.currentTarget.getAttribute('data-species');
            if (name) this.open(name);
        });
    },

    /** The species record behind a name, alive or extinct. */
    lookup(name) {
        return FossilRecord.extant_species[name]
            || FossilRecord.extinct_species[name]
            || null;
    },

    /** Can this name be opened in the editor? */
    isOpenable(name) {
        const species = this.lookup(name);
        return !!(species && anatomyOfSpecies(species));
    },

    /**
     * Markup for one name. Returns a plain escaped span when the species cannot
     * be opened, so an unopenable name never looks clickable.
     */
    render(name, escape, extra_class) {
        const safe = escape(name);
        if (!this.isOpenable(name)) {
            return extra_class ? `<span class='${extra_class}'>${safe}</span>` : safe;
        }
        const cls = ('species-link ' + (extra_class || '')).trim();
        return `<a href='#' class='${cls}' data-species='${safe}'` +
               ` title='Open ${safe} in the organism editor'>${safe}</a>`;
    },

    /** Load the named species onto the editor workbench and show it. */
    open(name) {
        const species = this.lookup(name);
        if (!species) return false;
        const anatomy = anatomyOfSpecies(species);
        if (!anatomy) return false;

        const cp = this.control_panel;
        const editor = cp && cp.engine ? cp.engine.organism_editor : null;
        if (!editor) return false;

        editor.setOrganismFromAnatomy(anatomy, name);

        // Same destination the Select tool reaches, so the two ways of
        // inspecting a creature land in the same place.
        if (!cp.control_panel_active) $('#maximize').click();
        $('#editor.tabnav-item').click();
        return true;
    },
};

module.exports = SpeciesLink;
