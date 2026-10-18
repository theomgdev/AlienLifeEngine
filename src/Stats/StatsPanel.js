const PopulationChart = require("./Charts/PopulationChart");
const SpeciesChart = require("./Charts/SpeciesChart");
const MutationChart = require("./Charts/MutationChart");
const CellsChart = require("./Charts/CellsChart");
const FossilRecord = require("./FossilRecord");
const SpeciesLink = require("../Controllers/SpeciesLink");


const ChartSelections = [PopulationChart, SpeciesChart, CellsChart, MutationChart];

class StatsPanel {
    constructor(env) {
        this.defineControls();
        this.chart_selection = 0;
        this.setChart();
        this.env = env;
        this.last_reset_count=env.reset_count;
    }

    setChart(selection=this.chart_selection) {
        this.chart_controller = new ChartSelections[selection]();
        this.chart_controller.setData();
        this.chart_controller.render();
    }

    startAutoRender() {
        this.setChart();
        this.render_loop = setInterval(function(){this.updateChart();}.bind(this), 1000);
    }

    stopAutoRender() {
        clearInterval(this.render_loop);
    }

    defineControls() {
        $('#chart-option').change ( function() {
            this.chart_selection = $("#chart-option")[0].selectedIndex;
            this.setChart();
        }.bind(this));
    }

    updateChart() {
        if (this.last_reset_count < this.env.reset_count){
            this.reset()
        }
        this.last_reset_count = this.env.reset_count;
        this.chart_controller.updateData();
        this.chart_controller.render();
    }

    updateDetails() {
        var org_count = this.env.organisms.length;
        var sp_count = FossilRecord.numExtantSpecies();
        $('#hud-live-pop').text(org_count);
        $('#hud-live-species').text(sp_count);
        $('#org-count').text("Total Population: " + org_count);
        $('#species-count').text("Number of Species: " + sp_count);
        let top_species = FossilRecord.getMostPopulousSpecies();
        if (top_species)
            this.renderTopSpecies(top_species);
        else {
            this.last_top = null;
            $('#top-species').text("Most Populous Species: None");
        }
        $('#largest-org').text("Largest Organism Ever: " + this.env.largest_cell_count + " cells");
        $('#avg-mut').text("Average Mutation Rate: " + Math.round(this.env.averageMutability() * 100) / 100);
    }

    /**
     * The dominant lineage, as a link to its body in the editor.
     *
     * This runs on every frame, and writing innerHTML that often is exactly the
     * kind of cost a clickable name must not introduce. The name changes rarely
     * while its population moves constantly, so the markup is rebuilt only when
     * the NAME changes and the count is written into its own text node the rest
     * of the time.
     */
    renderTopSpecies(species) {
        if (species.name !== this.last_top) {
            this.last_top = species.name;
            const esc = (s) => String(s).replace(/[&<>"]/g, ch =>
                ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
            $('#top-species').html(
                'Most Populous Species: "' + SpeciesLink.render(species.name, esc) +
                '" (<span id="top-species-pop"></span> organisms)');
        }
        $('#top-species-pop').text(species.population);
    }

    reset() {
        this.setChart();
    }
    
}

module.exports = StatsPanel;