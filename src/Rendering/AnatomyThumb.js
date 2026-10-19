// AnatomyThumb — draw a stored body as a small image.
//
// A species name in the Chronicle or the census says nothing about the creature
// behind it; opening each one in the editor to find out costs a click, a tab
// switch and the loss of whatever was on the workbench. Drawn small enough to
// sit in a tooltip, a body is recognisable at a glance, so a lineage can be read
// by moving along it rather than by visiting it.
//
// Pure rendering: it takes the shape FossilAnatomy already produces and returns
// a data URL. No DOM, no hover handling, no knowledge of where it is shown.

const CellStates = require("../Organism/Cell/CellStates");

// Eye slit geometry, matching CellStates.Eye.render so a thumbnail and the
// arena draw the same creature the same way. Facing is most of what separates
// two otherwise identical movers, so it has to survive the shrink.
const SLIT_MIN_PX = 5;

/**
 * Bounds of a body in local cell coordinates, inclusive.
 * Bodies are centred on (0,0) but not symmetric, so the extent has to be
 * measured rather than assumed from the cell count.
 */
function boundsOf(cells) {
    let min_c = Infinity, max_c = -Infinity, min_r = Infinity, max_r = -Infinity;
    for (const cell of cells) {
        if (cell.loc_col < min_c) min_c = cell.loc_col;
        if (cell.loc_col > max_c) max_c = cell.loc_col;
        if (cell.loc_row < min_r) min_r = cell.loc_row;
        if (cell.loc_row > max_r) max_r = cell.loc_row;
    }
    return { min_c, max_c, min_r, max_r };
}

/**
 * Render an anatomy (FossilAnatomy's format) to a PNG data URL.
 *
 * `max_px` bounds the longer side of the image; cell size is derived from the
 * body's extent so a 3-cell creature and a 30-cell one both fill the tooltip,
 * which is what makes them comparable side by side. Returns null for an empty
 * body so a caller can decide not to show anything at all.
 *
 * The pixel size comes back with the URL because a caller placing the image
 * needs its dimensions before the browser has decoded it.
 */
function renderAnatomy(anatomy, max_px = 72, min_cell_px = 3) {
    if (!anatomy || !anatomy.cells || !anatomy.cells.length) return null;

    const { min_c, max_c, min_r, max_r } = boundsOf(anatomy.cells);
    const cols = max_c - min_c + 1;
    const rows = max_r - min_r + 1;
    const cell_px = Math.max(min_cell_px, Math.floor(max_px / Math.max(cols, rows)));

    const canvas = document.createElement('canvas');
    canvas.width = cols * cell_px;
    canvas.height = rows * cell_px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    for (const cell of anatomy.cells) {
        const state = cell.state;
        if (!state) continue;
        const x = (cell.loc_col - min_c) * cell_px;
        const y = (cell.loc_row - min_r) * cell_px;
        ctx.fillStyle = state.color || '#888';
        ctx.fillRect(x, y, cell_px, cell_px);

        if (state === CellStates.eye && cell.direction !== undefined && cell_px >= SLIT_MIN_PX) {
            // CellStates.Eye.render's geometry at thumbnail scale: the slit is
            // drawn around the cell centre and rotated by the facing, so a
            // thumbnail eye points the same way the arena's does.
            const half = cell_px / 2;
            ctx.save();
            ctx.translate(x + half, y + half);
            ctx.rotate((cell.direction * 90) * Math.PI / 180);
            ctx.fillStyle = state.slit_color || '#0E1318';
            ctx.fillRect(-cell_px / 8, -half, cell_px / 4, half + cell_px / 4);
            ctx.restore();
        }
    }

    return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

/** Counts worth showing beside the picture, derived rather than stored. */
function describeAnatomy(anatomy) {
    if (!anatomy || !anatomy.cells) return null;
    let eyes = 0;
    for (const cell of anatomy.cells) {
        if (cell.state === CellStates.eye) eyes++;
    }
    // An eye is what makes a creature both mobile and thinking, so its presence
    // is the one trait worth stating next to the cell count.
    return { total: anatomy.cells.length, eyes, thinking: eyes > 0 };
}

module.exports = { renderAnatomy, describeAnatomy };
