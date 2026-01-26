# Agents Guide

This document provides guidance for AI agents working on the Toybox project.

## Project Overview

Toybox is a collection of kid-friendly browser games built with vanilla HTML, CSS, and JavaScript. No build tools or frameworks are required.

## Project Structure

```
toybox/
├── index.html          # Main game selection page
├── style.css           # Styles for the main page
└── games/
    ├── maze/           # Mouse maze game with cheese trail scoring (touch d-pad)
    ├── feathers/       # Feather collection game
    └── powder/         # Physics sandbox with many elements
```

Each game follows the same structure:
```
games/{game-name}/
├── index.html          # Game page
├── style.css           # Game styles
└── game.js             # Game logic
```

## Development Guidelines

### Code Style
- Use vanilla JavaScript (no frameworks)
- Keep games self-contained within their directories
- Use CSS for animations when possible
- Games should work on both desktop and mobile

### Adding a New Game
1. Create a new directory under `games/`
2. Add `index.html`, `style.css`, and `game.js`
3. Include a back button linking to `../../index.html`
4. Add a card for the new game in the root `index.html`

### Design Principles
- Games should be simple and fun for kids
- Use bright colors and clear visual feedback
- Include sound effects using Web Audio API
- Support keyboard and touch controls where appropriate (e.g., d-pad for maze game)

### Powder Play Element Interactions
The powder game has these elements and behaviors:
- **Sand** - Falls, displaces liquids
- **Water** - Flows, extinguishes fire, freezes near ice
- **Wall** - Static barrier (can be destroyed by explosions)
- **Fire** - Burns wood/plants, extinguished by water, ignites oil, melts ice
- **Wood** - Flammable, leaves ash when burned
- **Smoke** - Rises and dissipates
- **Oil** - Liquid, explodes on contact with fire (large radius)
- **Ice** - Freezes nearby water, melts near fire
- **Plant** - Grows upward when touching water, 20% chance to sprout flowers
- **Flower** - Colorful, flammable, spawns from plants
- **Ash** - Falls like sand, only left behind when fire burns wood/plants

## Testing

Open `index.html` in a browser to test. No build step is required. Each game can also be tested directly by opening its `index.html`.
