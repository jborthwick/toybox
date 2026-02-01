// Constants
const CELL_SIZE = 4;

// Calculate grid size based on available screen space
function calculateGridSize() {
    // Get safe area insets (for notches, home indicators, etc.)
    const style = getComputedStyle(document.documentElement);
    const safeTop = parseInt(style.getPropertyValue('--sat') || '0') || 0;
    const safeBottom = parseInt(style.getPropertyValue('--sab') || '0') || 0;
    const safeLeft = parseInt(style.getPropertyValue('--sal') || '0') || 0;
    const safeRight = parseInt(style.getPropertyValue('--sar') || '0') || 0;

    // Get available space (accounting for margins, safe areas, border, etc.)
    // 40px horizontal padding + 8px border (4px each side) + safe areas
    const maxWidth = window.innerWidth - 56 - safeLeft - safeRight;
    // 100px for back button/top margin + 20px bottom margin + 8px border + safe areas
    const maxHeight = window.innerHeight - 128 - safeTop - safeBottom;

    // Calculate grid dimensions - divide display size by cell size
    let width = Math.floor(maxWidth / CELL_SIZE);
    let height = Math.floor(maxHeight / CELL_SIZE);

    // Cap grid at reasonable maximums for performance
    width = Math.min(width, 320);
    height = Math.min(height, 200);

    // Ensure minimum playable size
    width = Math.max(width, 80);
    height = Math.max(height, 60);

    return { width, height };
}

const gridSize = calculateGridSize();
let WIDTH = gridSize.width;
let HEIGHT = gridSize.height;

// Element types
const TYPES = {
    EMPTY: 0,
    SAND: 1,
    WATER: 2,
    STONE: 3,
    FIRE: 4,
    WOOD: 5,
    SMOKE: 6,
    OIL: 7,
    ICE: 8,
    EXPLOSION: 9,
    PLANT: 10,
    ASH: 11,
    FLOWER: 12,
    KERNEL: 13,
    POPCORN: 14,
    DYNAMITE: 15,
    LAVA: 16,
};

// Element colors
const COLORS = {
    [TYPES.EMPTY]: '#1a1a2e',
    [TYPES.SAND]: '#e6c86e',
    [TYPES.WATER]: '#4a90d9',
    [TYPES.STONE]: '#6b6b6b',
    [TYPES.FIRE]: '#ff6b35',
    [TYPES.WOOD]: '#8b5a2b',
    [TYPES.SMOKE]: '#708090',
    [TYPES.OIL]: '#2d2d2d',
    [TYPES.ICE]: '#a8e4ef',
    [TYPES.EXPLOSION]: '#ffff00',
    [TYPES.PLANT]: '#228b22',
    [TYPES.ASH]: '#4a4a4a',
    [TYPES.FLOWER]: '#ff69b4',
    [TYPES.KERNEL]: '#f5d742',
    [TYPES.POPCORN]: '#fffef0',
    [TYPES.DYNAMITE]: '#cc2200',
    [TYPES.LAVA]: '#ff4500',
};

// Flower color variations
const FLOWER_COLORS = ['#ff69b4', '#ff1493', '#da70d6', '#ff6347', '#ffd700', '#87ceeb'];

// Fire color variations
const FIRE_COLORS = ['#ff6b35', '#ff8c42', '#ffd700', '#ff4500'];

// Explosion color variations
const EXPLOSION_COLORS = ['#ffff00', '#ffcc00', '#ff9900', '#ffffff'];

// Popcorn color variations (white/cream shades)
const POPCORN_COLORS = ['#fffef0', '#fff8dc', '#faf0e6', '#fffff0'];

// Lava color variations (orange/red glowing)
const LAVA_COLORS = ['#ff4500', '#ff6600', '#ff3300', '#ff5500', '#cc3300'];

// Game state
let grid = null;
let popcornCooldown = null; // Tracks freshly popped popcorn immunity frames
let dynamiteFuse = null; // Tracks fuse countdown for dynamite (0 = not lit, >0 = countdown)
let selectedType = TYPES.SAND;
let brushSize = 3;
let isDrawing = false;

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const brushSlider = document.getElementById('brush-size');
const clearBtn = document.getElementById('clear-btn');
const elementBtns = document.querySelectorAll('.element-btn');
const dynamiteBtn = document.getElementById('dynamite-btn');

// Tool mode: 'brush' or 'dynamite'
let toolMode = 'brush';

// Set canvas size
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.style.width = WIDTH * CELL_SIZE + 'px';
canvas.style.height = HEIGHT * CELL_SIZE + 'px';

// Helper functions
function getIndex(x, y) {
    return y * WIDTH + x;
}

function inBounds(x, y) {
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
}

function getCell(x, y) {
    return inBounds(x, y) ? grid[getIndex(x, y)] : TYPES.STONE;
}

function setCell(x, y, type) {
    if (inBounds(x, y)) {
        grid[getIndex(x, y)] = type;
    }
}

function isEmpty(x, y) {
    return getCell(x, y) === TYPES.EMPTY;
}

function isLiquid(type) {
    return type === TYPES.WATER || type === TYPES.OIL;
}

function isFlammable(type) {
    return type === TYPES.WOOD || type === TYPES.OIL || type === TYPES.PLANT;
}

function swap(x1, y1, x2, y2) {
    const i1 = getIndex(x1, y1);
    const i2 = getIndex(x2, y2);
    const temp = grid[i1];
    grid[i1] = grid[i2];
    grid[i2] = temp;
}

// Initialize grid
function initGrid() {
    grid = new Uint8Array(WIDTH * HEIGHT);
    popcornCooldown = new Uint8Array(WIDTH * HEIGHT);
    dynamiteFuse = new Uint16Array(WIDTH * HEIGHT); // Use 16-bit for longer fuse times
}

// Create explosion at position
function explode(cx, cy, radius) {
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (inBounds(nx, ny)) {
                    // Inner radius becomes explosion, outer becomes fire/smoke
                    if (dist < radius * 0.5) {
                        setCell(nx, ny, TYPES.EXPLOSION);
                    } else if (dist < radius * 0.75) {
                        setCell(nx, ny, TYPES.FIRE);
                    } else {
                        setCell(nx, ny, Math.random() < 0.5 ? TYPES.FIRE : TYPES.SMOKE);
                    }
                }
            }
        }
    }
}

// Update a single particle
function updateParticle(x, y, updated) {
    const type = getCell(x, y);
    const idx = getIndex(x, y);

    if (type === TYPES.EMPTY || type === TYPES.STONE || updated[idx]) {
        return;
    }

    const below = getCell(x, y + 1);
    const rand = Math.random();
    const dir = rand < 0.5 ? -1 : 1;

    if (type === TYPES.SAND) {
        // Sand falls down, can displace liquids
        if (isEmpty(x, y + 1) || isLiquid(below)) {
            swap(x, y, x, y + 1);
            updated[getIndex(x, y + 1)] = 1;
        } else if (isEmpty(x + dir, y + 1) || isLiquid(getCell(x + dir, y + 1))) {
            swap(x, y, x + dir, y + 1);
            updated[getIndex(x + dir, y + 1)] = 1;
        }
    } else if (type === TYPES.WATER || type === TYPES.OIL) {
        // Liquids flow down and sideways
        // Water sinks through oil
        if (isEmpty(x, y + 1) || (type === TYPES.WATER && getCell(x, y + 1) === TYPES.OIL)) {
            swap(x, y, x, y + 1);
            updated[getIndex(x, y + 1)] = 1;
        } else if (isEmpty(x + dir, y + 1)) {
            swap(x, y, x + dir, y + 1);
            updated[getIndex(x + dir, y + 1)] = 1;
        } else if (isEmpty(x + dir, y)) {
            swap(x, y, x + dir, y);
            updated[getIndex(x + dir, y)] = 1;
        } else if (isEmpty(x - dir, y)) {
            swap(x, y, x - dir, y);
            updated[getIndex(x - dir, y)] = 1;
        }
    } else if (type === TYPES.FIRE) {
        // Fire spreads to flammable materials, extinguished by water
        let burningMaterial = false;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighbor = getCell(x + dx, y + dy);
                // Oil explodes when touched by fire
                if (neighbor === TYPES.OIL && Math.random() < 0.3) {
                    explode(x + dx, y + dy, 15);
                    return;
                }
                // Wood and plant burn and leave ash
                if ((neighbor === TYPES.WOOD || neighbor === TYPES.PLANT) && Math.random() < 0.1) {
                    setCell(x + dx, y + dy, TYPES.FIRE);
                    burningMaterial = true;
                }
                // Track if we're adjacent to burnable material
                if (neighbor === TYPES.WOOD || neighbor === TYPES.PLANT) {
                    burningMaterial = true;
                }
                if (neighbor === TYPES.WATER) {
                    setCell(x, y, TYPES.SMOKE);
                    return;
                }
                // Fire melts ice into water
                if (neighbor === TYPES.ICE && Math.random() < 0.3) {
                    setCell(x + dx, y + dy, TYPES.WATER);
                }
            }
        }
        // Fire rises and eventually becomes smoke (or ash if burning material)
        if (Math.random() < 0.1) {
            // Only leave ash if fire was burning wood/plant
            if (burningMaterial && Math.random() < 0.5) {
                setCell(x, y, TYPES.ASH);
            } else {
                setCell(x, y, TYPES.SMOKE);
            }
        } else if (isEmpty(x, y - 1) && Math.random() < 0.3) {
            swap(x, y, x, y - 1);
            updated[getIndex(x, y - 1)] = 1;
        } else if (isEmpty(x + dir, y - 1) && Math.random() < 0.2) {
            swap(x, y, x + dir, y - 1);
        }
    } else if (type === TYPES.EXPLOSION) {
        // Explosion quickly turns to fire then smoke
        if (Math.random() < 0.4) {
            setCell(x, y, TYPES.FIRE);
        }
    } else if (type === TYPES.SMOKE) {
        // Smoke rises and dissipates
        if (Math.random() < 0.02) {
            setCell(x, y, TYPES.EMPTY);
        } else if (isEmpty(x, y - 1)) {
            swap(x, y, x, y - 1);
            updated[getIndex(x, y - 1)] = 1;
        } else if (isEmpty(x + dir, y - 1)) {
            swap(x, y, x + dir, y - 1);
        } else if (isEmpty(x + dir, y)) {
            swap(x, y, x + dir, y);
        }
    } else if (type === TYPES.ICE) {
        // Ice freezes nearby water and melts near fire/lava
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighbor = getCell(x + dx, y + dy);
                if (neighbor === TYPES.WATER && Math.random() < 0.15) {
                    setCell(x + dx, y + dy, TYPES.ICE);
                }
                if (neighbor === TYPES.FIRE || neighbor === TYPES.LAVA) {
                    setCell(x, y, TYPES.WATER);
                    return;
                }
            }
        }
    } else if (type === TYPES.PLANT) {
        // Plant grows when touching water
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighbor = getCell(x + dx, y + dy);
                if (neighbor === TYPES.WATER && Math.random() < 0.1) {
                    // Only consume water 20% of the time
                    if (Math.random() < 0.2) {
                        setCell(x + dx, y + dy, TYPES.EMPTY);
                    }
                    // Try to grow upward preferentially, then sideways
                    const growDirs = [
                        { gx: 0, gy: -1 },  // up
                        { gx: -1, gy: -1 }, // up-left
                        { gx: 1, gy: -1 },  // up-right
                        { gx: -1, gy: 0 },  // left
                        { gx: 1, gy: 0 },   // right
                    ];
                    for (const gd of growDirs) {
                        if (isEmpty(x + gd.gx, y + gd.gy)) {
                            // 20% chance to grow a flower instead of plant
                            if (Math.random() < 0.2) {
                                setCell(x + gd.gx, y + gd.gy, TYPES.FLOWER);
                            } else {
                                setCell(x + gd.gx, y + gd.gy, TYPES.PLANT);
                            }
                            break;
                        }
                    }
                }
            }
        }
    } else if (type === TYPES.ASH) {
        // Ash falls like sand but lighter (can float on water)
        if (isEmpty(x, y + 1)) {
            swap(x, y, x, y + 1);
            updated[getIndex(x, y + 1)] = 1;
        } else if (isEmpty(x + dir, y + 1)) {
            swap(x, y, x + dir, y + 1);
            updated[getIndex(x + dir, y + 1)] = 1;
        }
    } else if (type === TYPES.FLOWER) {
        // Flowers are static but can be burned
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (getCell(x + dx, y + dy) === TYPES.FIRE) {
                    setCell(x, y, TYPES.FIRE);
                    return;
                }
            }
        }
    } else if (type === TYPES.KERNEL) {
        // Kernels fall like sand and pop when heated
        let isHot = false;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx;
                const ny = y + dy;
                const neighbor = getCell(nx, ny);
                // Heat sources: fire, explosion, lava, or freshly popped popcorn (still hot!)
                if (neighbor === TYPES.FIRE || neighbor === TYPES.EXPLOSION || neighbor === TYPES.LAVA) {
                    isHot = true;
                    break;
                }
                // Freshly popped popcorn transfers heat to nearby kernels
                if (neighbor === TYPES.POPCORN && inBounds(nx, ny) && popcornCooldown[getIndex(nx, ny)] > 30) {
                    isHot = true;
                    break;
                }
            }
            if (isHot) break;
        }
        // Pop into popcorn when hot (25% chance per update when near heat)
        if (isHot && Math.random() < 0.25) {
            // Explosive pop! The kernel expands into a fluffy cluster
            setCell(x, y, TYPES.POPCORN);
            popcornCooldown[idx] = 60;

            // First, expand into adjacent empty spaces to make it "puffy"
            // Each kernel becomes 2-4 pieces of popcorn clustered together
            const expandDirs = [
                { dx: 0, dy: -1 },   // up (priority)
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },   // sides
                { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, // diagonal up
            ];
            let expanded = 0;
            const maxExpand = 1 + Math.floor(Math.random() * 3); // 1-3 extra pieces
            for (const ed of expandDirs) {
                if (expanded >= maxExpand) break;
                const ex = x + ed.dx;
                const ey = y + ed.dy;
                if (inBounds(ex, ey) && getCell(ex, ey) === TYPES.EMPTY) {
                    setCell(ex, ey, TYPES.POPCORN);
                    popcornCooldown[getIndex(ex, ey)] = 55 + Math.floor(Math.random() * 10);
                    updated[getIndex(ex, ey)] = 1;
                    expanded++;
                }
            }

            // Then launch some pieces upward for the explosive effect
            const launchDirs = [
                { dx: 0, dy: -2 }, { dx: 0, dy: -3 },  // straight up
                { dx: -1, dy: -2 }, { dx: 1, dy: -2 }, // diagonal up far
                { dx: -2, dy: -1 }, { dx: 2, dy: -1 }, // wide diagonal
            ];
            // Shuffle for randomness
            for (let i = launchDirs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [launchDirs[i], launchDirs[j]] = [launchDirs[j], launchDirs[i]];
            }
            const launchCount = 1 + Math.floor(Math.random() * 2); // 1-2 launched pieces
            let launched = 0;
            for (const ld of launchDirs) {
                if (launched >= launchCount) break;
                const lx = x + ld.dx;
                const ly = y + ld.dy;
                if (inBounds(lx, ly) && getCell(lx, ly) === TYPES.EMPTY) {
                    setCell(lx, ly, TYPES.POPCORN);
                    popcornCooldown[getIndex(lx, ly)] = 60;
                    updated[getIndex(lx, ly)] = 1;
                    launched++;
                }
            }
            return;
        }
        // Fall like sand
        if (isEmpty(x, y + 1) || isLiquid(below)) {
            swap(x, y, x, y + 1);
            updated[getIndex(x, y + 1)] = 1;
        } else if (isEmpty(x + dir, y + 1) || isLiquid(getCell(x + dir, y + 1))) {
            swap(x, y, x + dir, y + 1);
            updated[getIndex(x + dir, y + 1)] = 1;
        }
    } else if (type === TYPES.POPCORN) {
        // Decrement cooldown if active
        if (popcornCooldown[idx] > 0) {
            popcornCooldown[idx]--;
        }
        // Popcorn is light and fluffy - can be burned (but not while cooling down)
        if (popcornCooldown[idx] === 0) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const neighbor = getCell(x + dx, y + dy);
                    // Burns if touching fire or lava
                    if ((neighbor === TYPES.FIRE || neighbor === TYPES.LAVA) && Math.random() < 0.2) {
                        setCell(x, y, TYPES.FIRE);
                        return;
                    }
                }
            }
        }

        // Freshly popped popcorn rises rapidly (like it's exploding upward)
        if (popcornCooldown[idx] > 40) {
            // Rising phase - move up aggressively
            if (isEmpty(x, y - 1)) {
                const newIdx = getIndex(x, y - 1);
                popcornCooldown[newIdx] = popcornCooldown[idx];
                popcornCooldown[idx] = 0;
                swap(x, y, x, y - 1);
                updated[newIdx] = 1;
            } else if (isEmpty(x + dir, y - 1)) {
                const newIdx = getIndex(x + dir, y - 1);
                popcornCooldown[newIdx] = popcornCooldown[idx];
                popcornCooldown[idx] = 0;
                swap(x, y, x + dir, y - 1);
                updated[newIdx] = 1;
            } else if (isEmpty(x + dir, y)) {
                // Move sideways if can't go up
                const newIdx = getIndex(x + dir, y);
                popcornCooldown[newIdx] = popcornCooldown[idx];
                popcornCooldown[idx] = 0;
                swap(x, y, x + dir, y);
                updated[newIdx] = 1;
            }
        } else if (popcornCooldown[idx] > 20) {
            // Floating phase - drift up slowly or sideways
            if (Math.random() < 0.4) {
                if (isEmpty(x, y - 1) && Math.random() < 0.5) {
                    const newIdx = getIndex(x, y - 1);
                    popcornCooldown[newIdx] = popcornCooldown[idx];
                    popcornCooldown[idx] = 0;
                    swap(x, y, x, y - 1);
                    updated[newIdx] = 1;
                } else if (isEmpty(x + dir, y)) {
                    const newIdx = getIndex(x + dir, y);
                    popcornCooldown[newIdx] = popcornCooldown[idx];
                    popcornCooldown[idx] = 0;
                    swap(x, y, x + dir, y);
                    updated[newIdx] = 1;
                }
            }
        } else {
            // Settling phase - falls slowly (20% of updates)
            if (Math.random() < 0.2) {
                if (isEmpty(x, y + 1)) {
                    const newIdx = getIndex(x, y + 1);
                    popcornCooldown[newIdx] = popcornCooldown[idx];
                    popcornCooldown[idx] = 0;
                    swap(x, y, x, y + 1);
                    updated[newIdx] = 1;
                } else if (isEmpty(x + dir, y + 1)) {
                    const newIdx = getIndex(x + dir, y + 1);
                    popcornCooldown[newIdx] = popcornCooldown[idx];
                    popcornCooldown[idx] = 0;
                    swap(x, y, x + dir, y + 1);
                    updated[newIdx] = 1;
                }
            }
        }
    } else if (type === TYPES.DYNAMITE) {
        // Dynamite: lit fuse counts down, then explodes BIG
        // Fuse starts at 180 frames (~3 seconds at 60fps)
        if (dynamiteFuse[idx] > 0) {
            dynamiteFuse[idx]--;
            // BOOM when fuse reaches 0
            if (dynamiteFuse[idx] === 0) {
                explode(x, y, 25); // Big explosion radius
                return;
            }
        }
        // Falls like sand until it lands
        if (isEmpty(x, y + 1)) {
            const newIdx = getIndex(x, y + 1);
            dynamiteFuse[newIdx] = dynamiteFuse[idx];
            dynamiteFuse[idx] = 0;
            swap(x, y, x, y + 1);
            updated[newIdx] = 1;
        } else if (isEmpty(x + dir, y + 1)) {
            const newIdx = getIndex(x + dir, y + 1);
            dynamiteFuse[newIdx] = dynamiteFuse[idx];
            dynamiteFuse[idx] = 0;
            swap(x, y, x + dir, y + 1);
            updated[newIdx] = 1;
        }
        // Can be set off early by fire/explosion/lava
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighbor = getCell(x + dx, y + dy);
                if (neighbor === TYPES.FIRE || neighbor === TYPES.EXPLOSION || neighbor === TYPES.LAVA) {
                    explode(x, y, 25);
                    return;
                }
            }
        }
    } else if (type === TYPES.LAVA) {
        // Lava: viscous hot liquid that cools into stone when touching water
        // Check for interactions with neighbors
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighbor = getCell(x + dx, y + dy);
                // Water cools lava into stone and becomes steam
                if (neighbor === TYPES.WATER) {
                    setCell(x, y, TYPES.STONE);
                    setCell(x + dx, y + dy, TYPES.SMOKE); // Steam
                    return;
                }
                // Lava ignites flammable materials
                if (isFlammable(neighbor) && Math.random() < 0.15) {
                    setCell(x + dx, y + dy, TYPES.FIRE);
                }
                // Lava melts ice into water
                if (neighbor === TYPES.ICE && Math.random() < 0.4) {
                    setCell(x + dx, y + dy, TYPES.WATER);
                }
            }
        }
        // Lava flows slowly like viscous liquid (only moves 30% of updates)
        if (Math.random() < 0.3) {
            if (isEmpty(x, y + 1)) {
                swap(x, y, x, y + 1);
                updated[getIndex(x, y + 1)] = 1;
            } else if (isEmpty(x + dir, y + 1)) {
                swap(x, y, x + dir, y + 1);
                updated[getIndex(x + dir, y + 1)] = 1;
            } else if (isEmpty(x + dir, y)) {
                swap(x, y, x + dir, y);
                updated[getIndex(x + dir, y)] = 1;
            } else if (isEmpty(x - dir, y)) {
                swap(x, y, x - dir, y);
                updated[getIndex(x - dir, y)] = 1;
            }
        }
    }
}

// Run simulation step
function simulate() {
    const updated = new Uint8Array(WIDTH * HEIGHT);

    // Process from bottom to top for gravity
    for (let y = HEIGHT - 1; y >= 0; y--) {
        // Randomize left-right processing to avoid bias
        const leftToRight = Math.random() < 0.5;
        for (let i = 0; i < WIDTH; i++) {
            const x = leftToRight ? i : WIDTH - 1 - i;
            updateParticle(x, y, updated);
        }
    }
}

// Render the grid
function render() {
    const imageData = ctx.createImageData(WIDTH, HEIGHT);
    const data = imageData.data;

    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const type = grid[getIndex(x, y)];
            let color = COLORS[type];

            // Add visual variation
            if (type === TYPES.FIRE) {
                color = FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)];
            } else if (type === TYPES.WATER) {
                color = Math.random() < 0.1 ? '#5ba3ec' : '#4a90d9';
            } else if (type === TYPES.ICE) {
                color = Math.random() < 0.15 ? '#c4f0f7' : '#a8e4ef';
            } else if (type === TYPES.EXPLOSION) {
                color = EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)];
            } else if (type === TYPES.PLANT) {
                color = Math.random() < 0.2 ? '#2e8b2e' : '#228b22';
            } else if (type === TYPES.ASH) {
                color = Math.random() < 0.3 ? '#5a5a5a' : '#4a4a4a';
            } else if (type === TYPES.FLOWER) {
                color = FLOWER_COLORS[Math.floor((x * 7 + y * 13) % FLOWER_COLORS.length)];
            } else if (type === TYPES.KERNEL) {
                color = Math.random() < 0.2 ? '#d4b82e' : '#f5d742';
            } else if (type === TYPES.POPCORN) {
                color = POPCORN_COLORS[Math.floor(Math.random() * POPCORN_COLORS.length)];
            } else if (type === TYPES.DYNAMITE) {
                // Dynamite flickers as fuse burns down
                const fuse = dynamiteFuse[getIndex(x, y)];
                if (fuse > 0 && Math.random() < 0.3) {
                    color = '#ff4400'; // Flicker bright when lit
                } else {
                    color = '#cc2200';
                }
            } else if (type === TYPES.LAVA) {
                // Lava glows and flickers
                color = LAVA_COLORS[Math.floor(Math.random() * LAVA_COLORS.length)];
            }

            // Parse hex color
            const hex = color.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);

            const idx = (y * WIDTH + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

// Drop a single dynamite at position
function dropDynamite(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);

    if (inBounds(x, y) && isEmpty(x, y)) {
        setCell(x, y, TYPES.DYNAMITE);
        dynamiteFuse[getIndex(x, y)] = 180; // ~3 seconds at 60fps
    }
}

// Paint with brush
function paint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);

    for (let dx = -brushSize; dx <= brushSize; dx++) {
        for (let dy = -brushSize; dy <= brushSize; dy++) {
            // Circular brush
            if (dx * dx + dy * dy <= brushSize * brushSize) {
                const nx = x + dx;
                const ny = y + dy;
                if (inBounds(nx, ny)) {
                    // Eraser and stone can overwrite, others only fill empty
                    if (selectedType === TYPES.EMPTY || selectedType === TYPES.STONE || isEmpty(nx, ny)) {
                        setCell(nx, ny, selectedType);
                    }
                }
            }
        }
    }
}

// Event handlers
function handlePointerDown(e) {
    isDrawing = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (toolMode === 'dynamite') {
        dropDynamite(clientX, clientY);
    } else {
        paint(clientX, clientY);
    }
    e.preventDefault();
}

function handlePointerMove(e) {
    if (!isDrawing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // Dynamite only drops on click, not drag
    if (toolMode === 'brush') {
        paint(clientX, clientY);
    }
    e.preventDefault();
}

function handlePointerUp() {
    isDrawing = false;
}

// Set up event listeners
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('mouseup', handlePointerUp);
canvas.addEventListener('mouseleave', handlePointerUp);

canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
canvas.addEventListener('touchend', handlePointerUp);

// Element selection
elementBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        elementBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedType = parseInt(btn.dataset.type);
        // Switch back to brush mode when selecting an element
        toolMode = 'brush';
        dynamiteBtn.classList.remove('active');
    });
});

// Dynamite tool button
dynamiteBtn.addEventListener('click', () => {
    if (toolMode === 'dynamite') {
        // Toggle off - go back to brush mode
        toolMode = 'brush';
        dynamiteBtn.classList.remove('active');
    } else {
        // Toggle on - dynamite mode
        toolMode = 'dynamite';
        dynamiteBtn.classList.add('active');
        // Deselect element buttons visually
        elementBtns.forEach(b => b.classList.remove('selected'));
    }
});

// Brush size
brushSlider.addEventListener('input', () => {
    brushSize = parseInt(brushSlider.value);
});

// Clear button
clearBtn.addEventListener('click', initGrid);

// Main game loop
function gameLoop() {
    simulate();
    render();
    requestAnimationFrame(gameLoop);
}

// Start the game
initGrid();
gameLoop();
