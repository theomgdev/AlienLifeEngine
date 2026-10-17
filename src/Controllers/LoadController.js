// The upstream project shipped curated worlds, organisms and mod links in this
// panel. This engine does not carry those: its world files and brains are a
// different format and there is no mod loader. What a visitor needs instead is
// where the project lives, who it came from, and what else is worth playing.
const LoadController = {
    init() {
        $('#close-load-btn').click(() => {
            this.close();
        });
        $('#community-creations-btn').click(() => {
            this.open();
        });
        $('#load-custom-btn').click(() => {
            $('#upload-json').click();
        });

        this.render();
    },

    async render() {
        let data;
        try {
            const resp = await fetch('./assets/community.json');
            data = await resp.json();
        } catch (e) {
            console.error('Failed to load community data:', e);
            return;
        }

        const esc = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        // Only http(s) reaches an href. The file is ours, but a link target is
        // the one field where a typo becomes a javascript: URL.
        const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '#';

        const up = data.upstream || {};
        $('#community-upstream').html(
            `${esc(up.note || '')} ` +
            `<a href="${esc(safeUrl(up.repo))}" target="_blank" rel="noopener noreferrer">` +
            `${esc(up.name || 'upstream')}</a> by ${esc(up.author || '')}` +
            (up.demo ? ` &middot; <a href="${esc(safeUrl(up.demo))}" target="_blank" rel="noopener noreferrer">play it</a>` : '')
        );

        $('#community-link-grid').html((data.links || []).map((l) => `
            <a class="community-link" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">
                <i class="fa ${esc(l.icon || 'fa-link')}"></i>
                <span class="community-link-label">${esc(l.label)}</span>
                <span class="community-link-blurb">${esc(l.blurb || '')}</span>
            </a>`).join(''));

        const similar = data.similar || [];
        if (!similar.length) {
            $('#similar-projects').html('<p class="community-note">No entries yet.</p>');
            return;
        }
        $('#similar-projects').html(similar.map((s) => `
            <a class="similar-card" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">
                <span class="similar-name">${esc(s.name)}${s.demo ? '<span class="similar-demo">playable</span>' : ''}</span>
                <span class="similar-meta">${esc([s.language, s.stars ? s.stars + '\u2605' : null, s.status]
                    .filter(Boolean).join(' \u00b7 '))}</span>
                <span class="similar-why">${esc(s.why || '')}</span>
            </a>`).join(''));
    },

    async open() {
        $('.load-panel').addClass('open').css('display', 'flex');
    },

    loadJson(callback) {
        $('#upload-json').change((e) => {
            let files = e.target.files;
            if (!files.length) { return; }
            let reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    let json = JSON.parse(ev.target.result);
                    callback(json);
                    this.close();
                } catch (err) {
                    console.error(err);
                    alert('Failed to load');
                }
                $('#upload-json')[0].value = '';
            };
            reader.readAsText(files[0]);
        });
        $('#upload-json').click();
    },

    close() {
        $('.load-panel').removeClass('open').css('display', 'none');
        $('#upload-json').off('change');
    }
};

$(document).ready(() => {
    LoadController.init();
});

module.exports = LoadController;
