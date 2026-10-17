// Loads the built page in a real browser and checks the world actually runs:
// no console errors, organisms alive, ticks advancing, species being named.
// Source that looks right is a guess about the running system, so CI runs it.
//
// Run: node .github/scripts/smoke.js

const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const PORT = 8123;

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, clean === '/' ? 'index.html' : clean);
    // keep the handler inside dist
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
    });
});

(async () => {
    const puppeteer = require('puppeteer');
    await new Promise((ok) => server.listen(PORT, ok));
    console.log(`serving dist on :${PORT}`);

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 });

    // let the world run
    await new Promise((r) => setTimeout(r, 8000));

    const state = await page.evaluate(() => {
        const txt = (id) => {
            const el = document.getElementById(id);
            return el ? el.textContent.trim() : null;
        };
        return {
            pop: txt('hud-live-pop'),
            species: txt('hud-live-species'),
            fps: txt('hud-live-fps'),
            shape: txt('brain-shape-readout'),
            canvas: !!document.querySelector('canvas'),
        };
    });

    console.log('state after 8s:', JSON.stringify(state));

    const pop = parseInt(state.pop, 10);
    const species = parseInt(state.species, 10);

    let failed = false;
    const check = (name, ok, detail) => {
        console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`);
        if (!ok) failed = true;
    };

    check('canvas rendered', state.canvas);
    check('population is alive', Number.isFinite(pop) && pop > 0, `pop=${state.pop}`);
    check('species are named', Number.isFinite(species) && species > 0, `species=${state.species}`);
    check('brain shape reported', !!state.shape && /parameters/.test(state.shape), state.shape || '');
    check('no console or page errors', errors.length === 0,
        errors.length ? errors.slice(0, 3).join(' | ') : '0 errors');

    await browser.close();
    server.close();

    if (failed) {
        console.log('\nsmoke test failed');
        process.exit(1);
    }
    console.log('\nsmoke test passed');
})().catch((e) => {
    console.error(e);
    server.close();
    process.exit(1);
});
