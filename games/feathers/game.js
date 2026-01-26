// Game state
const FEATHER_COUNT = 5;
const LEAF_COUNT = 12;
const PLAYER_SIZE = 40;
const MOVE_SPEED = 8;
let collectedFeathers = 0;
let playerPos = { x: 230, y: 180 };
let feathers = [];

// DOM elements
const playArea = document.getElementById('play-area');
const featherCountDisplay = document.getElementById('feather-count');
const newGameButton = document.getElementById('new-game');
const winMessage = document.getElementById('win-message');
const playAgainButton = document.getElementById('play-again');

// Feather and leaf emojis for variety
const featherEmojis = ['🪶'];
const leafEmojis = ['🍂', '🍁', '🍃', '🌿', '☘️'];

// Sound effects using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    // Resume audio context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (type === 'move') {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 300;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.05;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.03);
    } else if (type === 'collect') {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.15;
        oscillator.start();
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        oscillator.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'win') {
        const notes = [523, 659, 784, 1047];
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
    }
}

// Get play area dimensions
function getPlayAreaSize() {
    return {
        width: playArea.offsetWidth,
        height: playArea.offsetHeight
    };
}

// Get random position within play area bounds
function getRandomPosition(size) {
    const area = getPlayAreaSize();
    const padding = 20;
    return {
        x: padding + Math.random() * (area.width - size - padding * 2),
        y: padding + Math.random() * (area.height - size - padding * 2)
    };
}

// Create player element
function createPlayer() {
    const player = document.createElement('div');
    player.id = 'player';
    player.textContent = '🐦';
    player.style.left = playerPos.x + 'px';
    player.style.top = playerPos.y + 'px';
    return player;
}

// Create a feather element
function createFeather(index) {
    const feather = document.createElement('div');
    feather.className = 'feather';
    feather.textContent = featherEmojis[0];
    feather.dataset.index = index;

    const pos = getRandomPosition(30);
    feather.style.left = pos.x + 'px';
    feather.style.top = pos.y + 'px';

    return { element: feather, x: pos.x, y: pos.y, collected: false };
}

// Create a leaf element
function createLeaf(index) {
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.textContent = leafEmojis[Math.floor(Math.random() * leafEmojis.length)];
    leaf.dataset.index = index;

    const pos = getRandomPosition(50);
    leaf.style.left = pos.x + 'px';
    leaf.style.top = pos.y + 'px';

    return leaf;
}

// Update player position on screen
function updatePlayerPosition() {
    const player = document.getElementById('player');
    if (player) {
        player.style.left = playerPos.x + 'px';
        player.style.top = playerPos.y + 'px';
    }
}

// Push leaves away from player
function pushLeaves() {
    const leaves = document.querySelectorAll('.leaf');
    const area = getPlayAreaSize();
    const pushRadius = 50;
    const pushStrength = 15;

    leaves.forEach(leaf => {
        const leafX = parseFloat(leaf.style.left);
        const leafY = parseFloat(leaf.style.top);

        const dx = leafX - playerPos.x;
        const dy = leafY - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < pushRadius && distance > 0) {
            const pushX = (dx / distance) * pushStrength;
            const pushY = (dy / distance) * pushStrength;

            let newX = leafX + pushX;
            let newY = leafY + pushY;

            // Keep within bounds
            newX = Math.max(0, Math.min(newX, area.width - 50));
            newY = Math.max(0, Math.min(newY, area.height - 50));

            leaf.style.left = newX + 'px';
            leaf.style.top = newY + 'px';
        }
    });
}

// Check for feather collection
function checkFeatherCollection() {
    const collectRadius = 30;

    feathers.forEach(feather => {
        if (feather.collected) return;

        const dx = feather.x - playerPos.x;
        const dy = feather.y - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < collectRadius) {
            feather.collected = true;
            feather.element.classList.add('collected');
            collectedFeathers++;
            playSound('collect');
            updateDisplay();

            setTimeout(() => {
                feather.element.remove();
            }, 500);

            if (collectedFeathers >= FEATHER_COUNT) {
                setTimeout(() => {
                    playSound('win');
                    winMessage.classList.remove('hidden');
                }, 600);
            }
        }
    });
}

// Move the player by direction
function movePlayer(dx, dy) {
    const area = getPlayAreaSize();

    const newX = playerPos.x + dx * MOVE_SPEED;
    const newY = playerPos.y + dy * MOVE_SPEED;

    // Keep within bounds
    playerPos.x = Math.max(0, Math.min(newX, area.width - PLAYER_SIZE));
    playerPos.y = Math.max(0, Math.min(newY, area.height - PLAYER_SIZE));

    playSound('move');
    updatePlayerPosition();
    pushLeaves();
    checkFeatherCollection();
}

// Move the player toward a target position (for click/tap)
let moveInterval = null;

function moveToward(targetX, targetY) {
    // Stop any existing movement
    if (moveInterval) {
        clearInterval(moveInterval);
    }

    moveInterval = setInterval(() => {
        const area = getPlayAreaSize();
        const dx = targetX - playerPos.x;
        const dy = targetY - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Stop if close enough to target
        if (distance < MOVE_SPEED) {
            clearInterval(moveInterval);
            moveInterval = null;
            return;
        }

        // Stop if game is won
        if (!winMessage.classList.contains('hidden')) {
            clearInterval(moveInterval);
            moveInterval = null;
            return;
        }

        // Move toward target
        const moveX = (dx / distance) * MOVE_SPEED;
        const moveY = (dy / distance) * MOVE_SPEED;

        playerPos.x = Math.max(0, Math.min(playerPos.x + moveX, area.width - PLAYER_SIZE));
        playerPos.y = Math.max(0, Math.min(playerPos.y + moveY, area.height - PLAYER_SIZE));

        playSound('move');
        updatePlayerPosition();
        pushLeaves();
        checkFeatherCollection();
    }, 50);
}

// Handle click/tap on play area
function handlePlayAreaClick(e) {
    if (!winMessage.classList.contains('hidden')) return;

    const rect = playArea.getBoundingClientRect();
    let clientX, clientY;

    if (e.type === 'touchstart') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        e.preventDefault();
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const targetX = clientX - rect.left - PLAYER_SIZE / 2;
    const targetY = clientY - rect.top - PLAYER_SIZE / 2;

    moveToward(targetX, targetY);
}

playArea.addEventListener('click', handlePlayAreaClick);
playArea.addEventListener('touchstart', handlePlayAreaClick, { passive: false });

// Handle keyboard input
document.addEventListener('keydown', (e) => {
    if (winMessage.classList.contains('hidden') === false) return;

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

// Update the feather count display
function updateDisplay() {
    featherCountDisplay.textContent = `Feathers: ${collectedFeathers} / ${FEATHER_COUNT}`;
}

// Start a new game
function newGame() {
    // Clear play area
    playArea.innerHTML = '';
    collectedFeathers = 0;
    feathers = [];
    winMessage.classList.add('hidden');
    updateDisplay();

    // Reset player position to center
    const area = getPlayAreaSize();
    playerPos = { x: area.width / 2 - PLAYER_SIZE / 2, y: area.height / 2 - PLAYER_SIZE / 2 };

    // Create feathers first (they go under leaves)
    for (let i = 0; i < FEATHER_COUNT; i++) {
        const feather = createFeather(i);
        feathers.push(feather);
        playArea.appendChild(feather.element);
    }

    // Create leaves on top
    for (let i = 0; i < LEAF_COUNT; i++) {
        playArea.appendChild(createLeaf(i));
    }

    // Create player on top of everything
    playArea.appendChild(createPlayer());
}

// Event listeners
newGameButton.addEventListener('click', newGame);
playAgainButton.addEventListener('click', newGame);

// Start the game
newGame();
