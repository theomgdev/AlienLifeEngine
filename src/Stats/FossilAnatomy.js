// FossilAnatomy — turn a stored body back into something the editor can load.
//
// A species in the Chronicle is a name until you can open it. Living species
// still hold their Anatomy object, but a dead one keeps only the compact
// snapshot written by FossilRecord.snapshotAnatomy: three numbers per cell plus
// an eye's facing. Both have to arrive at the editor in the one shape
// Organism.loadRaw understands, so the conversion lives here rather than being
// guessed at each call site.

const CellStates = require("../Organism/Cell/CellStates");

/** Expand a stored snapshot ({c, r, s, d}) into Anatomy.loadRaw's format. */
function rehydrateAnatomy(snapshot) {
    if (!snapshot || !snapshot.cells || !snapshot.cells.length) return null;
    const cells = [];
    for (const cell of snapshot.cells) {
        const state = CellStates[cell.s];
        // A body that somehow names an unknown tissue is skipped rather than
        // crashing the panel; the rest of the creature is still worth showing.
        if (!state) continue;
        const out = { loc_col: cell.c, loc_row: cell.r, state };
        if (cell.d !== undefined) out.direction = cell.d;
        cells.push(out);
    }
    if (!cells.length) return null;
    return { cells, birth_distance: snapshot.birth_distance || 4 };
}

/**
 * The body of any species record, living or dead, in loadRaw's format.
 *
 * A living Species holds the real Anatomy, whose cells are BodyCell objects with
 * `loc_col`/`loc_row`/`state`. A fossil stores its body in the SAME `anatomy`
 * field but as the compact snapshot, whose cells use `c`/`r`/`s`. Both have a
 * non-empty `cells` array, so the two are told apart by the shape of a cell
 * rather than by which field they arrived in — reading a snapshot as a live
 * anatomy yields cells with `state: undefined`, which only fails later inside
 * the cell factory.
 */
function anatomyOfSpecies(species) {
    if (!species) return null;
    const src = species.anatomy_snapshot || species.anatomy;
    if (!src || !src.cells || !src.cells.length) return null;

    const first = src.cells[0];
    const is_live = first.state !== undefined && first.loc_col !== undefined;
    if (!is_live) return rehydrateAnatomy(src);

    const cells = src.cells.map((cell) => {
        const out = {
            loc_col: cell.loc_col,
            loc_row: cell.loc_row,
            state: cell.state,
        };
        if (cell.direction !== undefined) out.direction = cell.direction;
        return out;
    });
    return { cells, birth_distance: src.birth_distance || 4 };
}

module.exports = { rehydrateAnatomy, anatomyOfSpecies };
