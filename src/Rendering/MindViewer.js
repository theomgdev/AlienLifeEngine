// MindViewer — draws a selected organism's actual mind, live.
//
// Clicking a creature used to report "Move Towards: food" from a lookup table
// that no longer exists. What matters now is the state vector: which channels are
// its own memory, which quarter it shares with everything nearby, and how hard
// the whole thing is currently firing. That is the feature of this engine, so it
// should be visible on any creature you point at.
//
// Rendered as a tiny canvas rather than DOM nodes: N can be 48, so that is up to
// 48 bars plus an NxN weight matrix, redrawn a few times a second.

const CELL = 7;        // px per weight matrix cell
const BAR_H = 44;      // px height of the state bar strip

class MindViewer {
    constructor(container_id) {
        this.container_id = container_id;
        this.canvas = null;
    }

    ensureCanvas() {
        if (this.canvas) return true;
        const host = document.getElementById(this.container_id);
        if (!host) return false;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'mind-canvas';
        this.canvas.style.borderRadius = '6px';
        this.canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
        this.canvas.style.marginTop = '6px';
        this.canvas.width = 240;
        this.canvas.height = 150;
        host.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        return true;
    }

    clear() {
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw one organism's mind. `info` comes from NeuralBrain.inspect().
     * Returns false when there is nothing to draw (a blind organism has no mind).
     */
    render(info) {
        if (!info || !this.ensureCanvas()) return false;
        const { N, shared_n, private_n, shared, gain } = info;
        const ctx = this.ctx;

        const bar_w = Math.max(2, Math.floor(220 / N));
        const matrix_px = Math.min(96, N * CELL);
        this.canvas.width = Math.max(240, bar_w * N + 20);
        this.canvas.height = BAR_H + matrix_px + 34;
        ctx.fillStyle = '#18202c';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // ---- state bars: shared channels first, then private memory ----
        // Centre line at zero, bars grow up for positive and down for negative,
        // so you can see the sign of a channel and not just its magnitude.
        const mid = 10 + BAR_H / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(10, mid);
        ctx.lineTo(10 + bar_w * N, mid);
        ctx.stroke();

        const state = shared.concat(info.private);
        for (let i = 0; i < state.length; i++) {
            const v = Math.max(-1, Math.min(1, state[i]));
            const h = v * (BAR_H / 2 - 2);
            // the shared quarter is the point of the engine, so it gets the accent
            ctx.fillStyle = i < shared_n ? '#6fe3c4' : '#8fa4bd';
            ctx.fillRect(10 + i * bar_w, mid - (h > 0 ? h : 0),
                         Math.max(1, bar_w - 1), Math.abs(h) || 1);
        }

        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#6fe3c4';
        ctx.fillText(`${shared_n} shared`, 10, BAR_H + 22);
        ctx.fillStyle = '#8fa4bd';
        // A brain only fills its private memory by thinking, and the organism on
        // the editor bench never ticks. Flat bars there are correct, but silently
        // flat reads as broken, so the panel says which it is.
        const idle = info.private.every((v) => v === 0);
        ctx.fillText(`${private_n} private${idle ? ' (idle)' : ''}`,
            10 + bar_w * shared_n + 4, BAR_H + 22);
        ctx.fillStyle = '#68727f';
        ctx.fillText(`gain ${Number.isFinite(gain) ? gain.toFixed(2) : '--'}`,
            this.canvas.width - 58, BAR_H + 22);

        // ---- weight matrix: the inherited, evolved part ----
        const cell = Math.max(1, Math.floor(matrix_px / N));
        const ox = 10, oy = BAR_H + 28;
        const W = info.weights;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const w = W[r * N + c];
                const m = Math.max(-1, Math.min(1, w / 2));
                // red for inhibition, blue for excitation — sign is what reads
                if (m >= 0) ctx.fillStyle = `rgba(110,170,255,${m.toFixed(3)})`;
                else ctx.fillStyle = `rgba(255,110,120,${(-m).toFixed(3)})`;
                ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
            }
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeRect(ox - 0.5, oy - 0.5, N * cell + 1, N * cell + 1);
        ctx.fillStyle = '#68727f';
        ctx.fillText(`${N}x${N} weights`, ox + N * cell + 8, oy + 10);
        ctx.fillText('blue +, red -', ox + N * cell + 8, oy + 24);
        return true;
    }
}

module.exports = MindViewer;
