// const CellTypes = require("../Organism/Cell/CellTypes");
const CellStates = require("../Organism/Cell/CellStates");
const Directions = require("../Organism/Directions");

// Renderer controls access to a canvas. There is one renderer for each canvas
class Renderer {
    constructor(canvas_id, container_id, cell_size) {
        this.cell_size = cell_size;
        this.canvas = document.getElementById(canvas_id);
        this.ctx = this.canvas.getContext("2d");
        this.fillWindow(container_id)
		this.height = this.canvas.height;
        this.width = this.canvas.width;
        this.cells_to_render = new Set();
        this.cells_to_highlight = new Set();
        this.highlighted_cells = new Set();
    }

    fillWindow(container_id) {
        this.fillShape($('#'+container_id).height(), $('#'+container_id).width());
    }

    fillShape(height, width) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.height = this.canvas.height;
        this.width = this.canvas.width;
    }

    clear() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.height, this.width);
    }

    renderFullGrid(grid) {
        for (var col of grid) {
            for (var cell of col){
                this.renderCell(cell);
            }
        }
    }

    renderCells() {
        for (var cell of this.cells_to_render) {
            this.renderCell(cell);
        }
        this.cells_to_render.clear();
    }

    /**
     * Draw the collective field as soft organic blobs on a dedicated canvas
     * stacked above the grid.
     *
     * This is the hive mind made visible: each organism deposits its shared state
     * into a disc around itself, so populations grow smooth coloured territories
     * and you can watch thought spread across the map. Hue says which way a region's
     * collective leans, alpha says how strongly it is thinking.
     *
     * The field data is circular (see CollectiveField), so the drawing must be too:
     * painting one flat rect per tile produced a hard-edged chessboard regardless.
     * Instead the field is rasterised into a small ImageData (one pixel per tile)
     * and then scaled up with the browser's own bilinear filter, which turns the
     * tile grid into gradients for free. One putImageData plus one drawImage, so it
     * is also cheaper than the per-tile fillRect loop it replaces.
     */
    renderCollectiveOverlay(field) {
        const o = this._ensureOverlay();
        if (!o) return;
        const tc = field.tile_cols, tr = field.tile_rows;

        // (re)allocate the small scratch buffer when the field shape changes
        if (!o.buf || o.buf.width !== tc || o.buf.height !== tr) {
            o.buf = document.createElement('canvas');
            o.buf.width = tc;
            o.buf.height = tr;
            o.bufCtx = o.buf.getContext('2d');
            o.img = o.bufCtx.createImageData(tc, tr);
        }

        const data = o.img.data;
        let any = false;
        for (let t = 0; t < field.tiles; t++) {
            const p = t * 4;
            const intensity = field.tileIntensity(t);
            if (intensity < 0.002) {            // silent region: fully transparent
                data[p + 3] = 0;
                continue;
            }
            any = true;
            const v = field.tileVector(t);
            const a = v[0] || 0;
            const b = field.channels > 1 ? v[1] : 0;
            // direction of the collective lean -> hue; magnitude -> alpha
            const hue = (Math.atan2(b, a) / Math.PI) * 180 + 180;
            const rgb = hslToRgb(hue / 360, 0.95, 0.58);
            data[p] = rgb[0];
            data[p + 1] = rgb[1];
            data[p + 2] = rgb[2];
            data[p + 3] = Math.min(190, 24 + intensity * 460) | 0;
        }

        const ctx = o.ctx;
        ctx.clearRect(0, 0, o.canvas.width, o.canvas.height);
        if (!any) return;
        o.bufCtx.putImageData(o.img, 0, 0);
        // bilinear upscale: this is what turns tiles into blobs
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(o.buf, 0, 0, tc, tr,
                      0, 0, tc * field.tile_size * this.cell_size,
                            tr * field.tile_size * this.cell_size);
    }

    clearCollectiveOverlay() {
        if (this._overlay) {
            this._overlay.ctx.clearRect(0, 0, this._overlay.canvas.width, this._overlay.canvas.height);
        }
    }

    /**
     * Copy the grid canvas's CSS transform onto the overlay.
     *
     * Called from the zoom handler and resetView rather than from render(), because
     * getComputedStyle forces a style recalc and render() runs every frame — and
     * because zooming while paused produces no render tick at all, which is exactly
     * how the overlay used to drift out of alignment on zoom while panning stayed
     * correct (panning moves offsetLeft/Top, which the per-frame sync does pick up).
     */
    syncOverlayTransform() {
        const o = this._overlay;
        if (!o || typeof window === 'undefined' || !window.getComputedStyle) return;
        const cs = window.getComputedStyle(this.canvas);
        o.canvas.style.transform = cs.transform;
        o.canvas.style.transformOrigin = cs.transformOrigin;
        o.tf = cs.transform;
        o.org = cs.transformOrigin;
    }

    _ensureOverlay() {
        if (typeof document === 'undefined' || !this.canvas) return null;
        let created = false;
        if (!this._overlay) {
            const c = document.createElement('canvas');
            c.id = this.canvas.id + '-collective';
            c.style.position = 'absolute';
            c.style.pointerEvents = 'none';   // never steal clicks from the grid
            if (this.canvas.parentElement) this.canvas.parentElement.appendChild(c);
            this._overlay = { canvas: c, ctx: c.getContext('2d'), tf: '', org: '' };
            created = true;
        }
        const o = this._overlay;
        // Cheap per-frame sync: size and pan position. These are plain layout reads
        // that do not need a style recalc.
        if (o.canvas.width !== this.canvas.width) o.canvas.width = this.canvas.width;
        if (o.canvas.height !== this.canvas.height) o.canvas.height = this.canvas.height;
        o.canvas.style.left = this.canvas.offsetLeft + 'px';
        o.canvas.style.top = this.canvas.offsetTop + 'px';
        o.canvas.style.width = this.canvas.offsetWidth + 'px';
        o.canvas.style.height = this.canvas.offsetHeight + 'px';
        // Zoom is pushed in by the zoom handler; sync once on creation so an overlay
        // enabled mid-session picks up the current zoom level.
        if (created) this.syncOverlayTransform();
        return o;
    }

    renderCell(cell) {
        cell.state.render(this.ctx, cell, this.cell_size);
    }

    renderOrganism(org) {
        for(var org_cell of org.anatomy.cells) {
            var cell = org.getRealCell(org_cell);
            this.renderCell(cell);
        }
    }

    addToRender(cell) {
        if (this.highlighted_cells.has(cell)){
            this.cells_to_highlight.add(cell);
        }
        this.cells_to_render.add(cell);
    }

    renderHighlights() {
        for (var cell of this.cells_to_highlight) {
            this.renderCellHighlight(cell);
            this.highlighted_cells.add(cell);
        }
        this.cells_to_highlight.clear();
        
    }

    highlightOrganism(org) {
        for(var org_cell of org.anatomy.cells) {
            var cell = org.getRealCell(org_cell);
            this.cells_to_highlight.add(cell);
        }
    }

    highlightCell(cell) {
        this.cells_to_highlight.add(cell);
    }

    renderCellHighlight(cell, color="yellow") {
        this.renderCell(cell);
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillRect(cell.x, cell.y, this.cell_size, this.cell_size);
        this.ctx.globalAlpha = 1;
        this.highlighted_cells.add(cell);
    }

    clearAllHighlights(clear_to_highlight=false) {
        for (var cell of this.highlighted_cells) {
            this.renderCell(cell);
        }
        this.highlighted_cells.clear();
        if (clear_to_highlight) {
            this.cells_to_highlight.clear();
        }
    }
}

// HSL -> RGB, needed because the overlay writes raw pixels into an ImageData
// buffer instead of going through ctx.fillStyle colour strings.
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
}

module.exports = Renderer;
