// Game state
let maze = [];
let playerPos = { x: 1, y: 1 };
let goalPos = { x: 0, y: 0 };
let mazeSize = 7;
let cheeses = [];
let score = 0;

// Sound effects using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    // Resume audio context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'move') {
        oscillator.frequency.value = 300;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'win') {
        // Play a happy ascending melody
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.value = 0.2;
            osc.start(audioCtx.currentTime + i * 0.15);
            osc.stop(audioCtx.currentTime + i * 0.15 + 0.15);
        });
        return;
    } else if (type === 'cheese') {
        // Play a happy chirp for collecting cheese
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.15;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }
}

// DOM elements
const mazeElement = document.getElementById('maze');
const sizeSelect = document.getElementById('size');
const newMazeButton = document.getElementById('new-maze');
const winMessage = document.getElementById('win-message');
const playAgainButton = document.getElementById('play-again');

// Generate a maze using recursive backtracking
function generateMaze(size) {
    // Initialize maze with all walls
    const maze = [];
    for (let y = 0; y < size; y++) {
        maze[y] = [];
        for (let x = 0; x < size; x++) {
            maze[y][x] = 1; // 1 = wall
        }
    }

    // Recursive backtracking to carve paths
    function carve(x, y) {
        maze[y][x] = 0; // 0 = path

        // Directions: up, right, down, left
        const directions = [
            { dx: 0, dy: -2 },
            { dx: 2, dy: 0 },
            { dx: 0, dy: 2 },
            { dx: -2, dy: 0 }
        ];

        // Shuffle directions randomly
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        for (const dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            // Check if the new position is within bounds and is a wall
            if (newX > 0 && newX < size - 1 && newY > 0 && newY < size - 1 && maze[newY][newX] === 1) {
                // Carve through the wall between current and new position
                maze[y + dir.dy / 2][x + dir.dx / 2] = 0;
                carve(newX, newY);
            }
        }
    }

    // Start carving from position (1, 1)
    carve(1, 1);

    return maze;
}

// Render the maze to the DOM
function renderMaze() {
    mazeElement.innerHTML = '';
    mazeElement.style.gridTemplateColumns = `repeat(${mazeSize}, 1fr)`;

    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;

            // Check if this cell has a bonus cheese
            const hasCheese = cheeses.some(c => c.x === x && c.y === y);

            if (x === playerPos.x && y === playerPos.y) {
                cell.classList.add('player');
            } else if (x === goalPos.x && y === goalPos.y) {
                cell.classList.add('goal');
                cell.textContent = '🕳️';
            } else if (hasCheese) {
                cell.classList.add('path', 'cheese');
                cell.textContent = '🧀';
            } else if (maze[y][x] === 1) {
                cell.classList.add('wall');
            } else {
                cell.classList.add('path');
            }

            mazeElement.appendChild(cell);
        }
    }
}

// Find a valid goal position (far from start)
function findGoalPosition() {
    let bestPos = { x: 1, y: 1 };
    let maxDistance = 0;

    for (let y = 1; y < mazeSize - 1; y++) {
        for (let x = 1; x < mazeSize - 1; x++) {
            if (maze[y][x] === 0) {
                const distance = Math.abs(x - 1) + Math.abs(y - 1);
                if (distance > maxDistance) {
                    maxDistance = distance;
                    bestPos = { x, y };
                }
            }
        }
    }

    return bestPos;
}

// Find the solution path using BFS
function findSolutionPath() {
    const start = { x: 1, y: 1 };
    const goal = goalPos;
    const queue = [{ x: start.x, y: start.y, path: [] }];
    const visited = new Set();
    visited.add(`${start.x},${start.y}`);

    const directions = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];

    while (queue.length > 0) {
        const current = queue.shift();

        if (current.x === goal.x && current.y === goal.y) {
            return current.path;
        }

        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            const key = `${nx},${ny}`;

            if (nx >= 0 && nx < mazeSize && ny >= 0 && ny < mazeSize &&
                maze[ny][nx] === 0 && !visited.has(key)) {
                visited.add(key);
                queue.push({
                    x: nx,
                    y: ny,
                    path: [...current.path, { x: nx, y: ny }]
                });
            }
        }
    }

    return [];
}

// Place cheeses along the solution path
function placeCheeses() {
    cheeses = [];
    const solutionPath = findSolutionPath();

    // Remove the goal position from the path (last element)
    const pathWithoutGoal = solutionPath.slice(0, -1);

    // Place cheeses at intervals along the path
    // More spacing for smaller mazes, less for larger ones
    const spacing = Math.max(2, Math.floor(mazeSize / 5));

    for (let i = spacing - 1; i < pathWithoutGoal.length; i += spacing) {
        cheeses.push(pathWithoutGoal[i]);
    }
}

// Start a new game
function newGame() {
    mazeSize = parseInt(sizeSelect.value);
    maze = generateMaze(mazeSize);
    playerPos = { x: 1, y: 1 };
    goalPos = findGoalPosition();
    placeCheeses();
    score = 0;
    updateScore();
    winMessage.classList.add('hidden');
    renderMaze();
}

// Update score display
function updateScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = score;
    }
}

// Move the player
function movePlayer(dx, dy) {
    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;

    // Check bounds and walls
    if (newX >= 0 && newX < mazeSize && newY >= 0 && newY < mazeSize && maze[newY][newX] === 0) {
        playerPos.x = newX;
        playerPos.y = newY;

        // Check for cheese collection
        const cheeseIndex = cheeses.findIndex(c => c.x === newX && c.y === newY);
        if (cheeseIndex !== -1) {
            cheeses.splice(cheeseIndex, 1);
            score += 10;
            updateScore();
            playSound('cheese');
        } else {
            playSound('move');
        }

        renderMaze();

        // Check for win
        if (playerPos.x === goalPos.x && playerPos.y === goalPos.y) {
            playSound('win');
            setTimeout(() => {
                document.getElementById('final-score').textContent = score;
                winMessage.classList.remove('hidden');
            }, 100);
        }
    }
}

// Handle keyboard input
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            e.preventDefault();
            movePlayer(0, -1);
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            e.preventDefault();
            movePlayer(0, 1);
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            e.preventDefault();
            movePlayer(-1, 0);
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            e.preventDefault();
            movePlayer(1, 0);
            break;
    }
});

// Button event listeners
newMazeButton.addEventListener('click', newGame);
playAgainButton.addEventListener('click', newGame);

// D-pad button event listeners
document.querySelectorAll('.d-pad-btn').forEach(btn => {
    const handler = (e) => {
        e.preventDefault();
        // Resume audio context on touch (required for iOS/mobile)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const dir = btn.dataset.dir;
        switch (dir) {
            case 'up': movePlayer(0, -1); break;
            case 'down': movePlayer(0, 1); break;
            case 'left': movePlayer(-1, 0); break;
            case 'right': movePlayer(1, 0); break;
        }
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: false });
});

// Start the game
newGame();
