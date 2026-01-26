// Constants
const CELL_SIZE = 4;
const WIDTH = 160;
const HEIGHT = 120;

// Element types
const TYPES = {
    EMPTY: 0,
    SAND: 1,
    WATER: 2,
    WALL: 3,
    FIRE: 4,
    WOOD: 5,
    SMOKE: 6,
    OIL: 7,
};

// Element colors
const COLORS = {
    [TYPES.EMPTY]: '#1a1a2e',
    [TYPES.SAND]: '#e6c86e',
    [TYPES.WATER]: '#4a90d9',
    [TYPES.WALL]: '#6b6b6b',
    [TYPES.FIRE]: '#ff6b35',
    [TYPES.WOOD]: '#8b5a2b',
    [TYPES.SMOKE]: '#708090',
    [TYPES.OIL]: '#2d2d2d',
};

// Fire color variations
const FIRE_COLORS = ['#ff6b35', '#ff8c42', '#ffd700', '#ff4500'];

// Game state
let grid = null;
let selectedType = TYPES.SAND;
let brushSize = 3;
let isDrawing = false;

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const brushSlider = document.getElementById('brush-size');
const brushValue = document.getElementById('brush-value');
const clearBtn = document.getElementById('clear-btn');
const elementBtns = document.querySelectorAll('.element-btn');

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
    return inBounds(x, y) ? grid[getIndex(x, y)] : TYPES.WALL;
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
    return type === TYPES.WOOD || type === TYPES.OIL;
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
}

// Update a single particle
function updateParticle(x, y, updated) {
    const type = getCell(x, y);
    const idx = getIndex(x, y);

    if (type === TYPES.EMPTY || type === TYPES.WALL || updated[idx]) {
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
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const neighbor = getCell(x + dx, y + dy);
                if (isFlammable(neighbor) && Math.random() < 0.1) {
                    setCell(x + dx, y + dy, TYPES.FIRE);
                }
                if (neighbor === TYPES.WATER) {
                    setCell(x, y, TYPES.SMOKE);
                    return;
                }
            }
        }
        // Fire rises and eventually becomes smoke
        if (Math.random() < 0.1) {
            setCell(x, y, TYPES.SMOKE);
        } else if (isEmpty(x, y - 1) && Math.random() < 0.3) {
            swap(x, y, x, y - 1);
            updated[getIndex(x, y - 1)] = 1;
        } else if (isEmpty(x + dir, y - 1) && Math.random() < 0.2) {
            swap(x, y, x + dir, y - 1);
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
                    // Eraser and wall can overwrite, others only fill empty
                    if (selectedType === TYPES.EMPTY || selectedType === TYPES.WALL || isEmpty(nx, ny)) {
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
    paint(clientX, clientY);
    e.preventDefault();
}

function handlePointerMove(e) {
    if (!isDrawing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    paint(clientX, clientY);
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
    });
});

// Brush size
brushSlider.addEventListener('input', () => {
    brushSize = parseInt(brushSlider.value);
    brushValue.textContent = brushSize;
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
