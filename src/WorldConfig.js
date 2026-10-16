const WorldConfig = {
    headless: false,
    clear_walls_on_reset: false,
    auto_reset: true,
    auto_pause: false,
    brush_size: 2,
    // Draw the collective field as culture patches over the grid (hotkey: V).
    // Off by default: the world should read as organisms first. A one-time hint
    // tells the user the overlay exists, instead of leaving it undiscovered.
    show_collective_field: false,
}

module.exports = WorldConfig;