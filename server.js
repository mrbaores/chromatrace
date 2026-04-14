const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const COLS = 80;
const ROWS = 45;
const CELL_SIZE = 16;
const TICK_MS = 120;
const STATE_MS = 100;
const DISCONNECT_GRACE_MS = 3000;
const RESPAWN_MS = 2000;
const ITEM_MIN_MS = 6000;
const ITEM_MAX_MS = 12000;
const BOOST_MS = 5000;
const SHIELD_MS = 5000;
const BASE_RADIUS = 1;

const COLORS = [
    '#06b6d4', '#d946ef', '#84cc16', '#eab308',
    '#f97316', '#fb7185', '#60a5fa', '#14b8a6',
    '#34d399', '#a78bfa', '#f87171', '#fbbf24',
    '#4ade80', '#38bdf8', '#ec4899', '#8b5cf6'
];

const SPAWN_POINTS = [
    { x: 8, y: 8 }, { x: COLS - 9, y: 8 },
    { x: 8, y: ROWS - 9 }, { x: COLS - 9, y: ROWS - 9 },
    { x: Math.floor(COLS / 2), y: 8 }, { x: Math.floor(COLS / 2), y: ROWS - 9 },
    { x: 8, y: Math.floor(ROWS / 2) }, { x: COLS - 9, y: Math.floor(ROWS / 2) },
    { x: 12, y: 12 }, { x: COLS - 13, y: 12 },
    { x: 12, y: ROWS - 13 }, { x: COLS - 13, y: ROWS - 13 },
    { x: Math.floor(COLS * 0.3), y: Math.floor(ROWS * 0.3) },
    { x: Math.floor(COLS * 0.7), y: Math.floor(ROWS * 0.3) },
    { x: Math.floor(COLS * 0.3), y: Math.floor(ROWS * 0.7) },
    { x: Math.floor(COLS * 0.7), y: Math.floor(ROWS * 0.7) },
    { x: Math.floor(COLS / 3), y: Math.floor(ROWS / 3) },
    { x: Math.floor(COLS * 2 / 3), y: Math.floor(ROWS / 3) },
    { x: Math.floor(COLS / 3), y: Math.floor(ROWS * 2 / 3) },
    { x: Math.floor(COLS * 2 / 3), y: Math.floor(ROWS * 2 / 3) }
];

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const state = {
    grid: createGrid(),
    players: new Map(),
    socketToPlayer: new Map(),
    nextPlayerNumId: 1,
    items: [],
    nextItemId: 1,
    nextItemAt: Date.now() + randomInt(ITEM_MIN_MS, ITEM_MAX_MS),
    startedAt: Date.now()
};

function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function chooseDirection(inputX, inputY, fallbackX, fallbackY) {
    const deadZone = 0.2;
    if (Math.abs(inputX) < deadZone && Math.abs(inputY) < deadZone) {
        return { dx: fallbackX, dy: fallbackY };
    }

    if (Math.abs(inputX) >= Math.abs(inputY)) {
        return { dx: inputX >= 0 ? 1 : -1, dy: 0 };
    }
    return { dx: 0, dy: inputY >= 0 ? 1 : -1 };
}

function findPlayerByNumId(numId) {
    for (const player of state.players.values()) {
        if (player.numId === numId) {
            return player;
        }
    }
    return null;
}

function getUsedColors() {
    const used = new Set();
    for (const player of state.players.values()) {
        used.add(player.color.toLowerCase());
    }
    return used;
}

function chooseColor(preferredColor) {
    const used = getUsedColors();

    if (preferredColor && !used.has(preferredColor.toLowerCase())) {
        return preferredColor;
    }

    const freeColor = COLORS.find((color) => !used.has(color.toLowerCase()));
    return freeColor || COLORS[randomInt(0, COLORS.length - 1)];
}

function cellKey(x, y) {
    return `${x}:${y}`;
}

function getSpawnPoint(player) {
    const index = (player.numId - 1) % SPAWN_POINTS.length;
    return SPAWN_POINTS[index];
}

function clearPlayerTerritory(player) {
    for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
            if (state.grid[y][x] === player.numId) {
                state.grid[y][x] = 0;
            }
        }
    }
}

function paintBase(player, centerX, centerY) {
    for (let y = centerY - BASE_RADIUS; y <= centerY + BASE_RADIUS; y += 1) {
        for (let x = centerX - BASE_RADIUS; x <= centerX + BASE_RADIUS; x += 1) {
            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                state.grid[y][x] = player.numId;
            }
        }
    }
}

function resetTrail(player) {
    player.trail = [];
    player.trailSet.clear();
    player.outside = false;
}

function respawnPlayer(player) {
    clearPlayerTerritory(player);
    resetTrail(player);

    const spawn = getSpawnPoint(player);
    player.x = clamp(spawn.x, 1, COLS - 2);
    player.y = clamp(spawn.y, 1, ROWS - 2);
    player.dirX = 1;
    player.dirY = 0;
    player.inputX = 1;
    player.inputY = 0;
    player.alive = true;
    player.respawnAt = 0;
    player.lastDeathReason = '';
    player.boostUntil = 0;
    player.shieldUntil = 0;
    paintBase(player, player.x, player.y);
}

function killPlayer(player, reason) {
    player.alive = false;
    player.lastDeathReason = reason;
    player.respawnAt = Date.now() + RESPAWN_MS;
    clearPlayerTerritory(player);
    resetTrail(player);
    player.boostUntil = 0;
    player.shieldUntil = 0;
}

function addTrailCell(player, x, y) {
    const last = player.trail[player.trail.length - 1];
    if (last && last.x === x && last.y === y) {
        return;
    }
    const key = cellKey(x, y);
    player.trail.push({ x, y });
    player.trailSet.add(key);
}

function rebuildScores() {
    const counts = new Map();
    for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
            const owner = state.grid[y][x];
            if (owner !== 0) {
                counts.set(owner, (counts.get(owner) || 0) + 1);
            }
        }
    }

    for (const player of state.players.values()) {
        player.score = counts.get(player.numId) || 0;
    }
}

function captureArea(player) {
    const blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const queue = [];

    for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
            if (state.grid[y][x] === player.numId) {
                blocked[y][x] = true;
            }
        }
    }

    for (const cell of player.trail) {
        if (cell.x >= 0 && cell.x < COLS && cell.y >= 0 && cell.y < ROWS) {
            blocked[cell.y][cell.x] = true;
        }
    }

    function enqueueIfFree(x, y) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
            return;
        }
        if (blocked[y][x] || visited[y][x]) {
            return;
        }
        visited[y][x] = true;
        queue.push({ x, y });
    }

    for (let x = 0; x < COLS; x += 1) {
        enqueueIfFree(x, 0);
        enqueueIfFree(x, ROWS - 1);
    }
    for (let y = 0; y < ROWS; y += 1) {
        enqueueIfFree(0, y);
        enqueueIfFree(COLS - 1, y);
    }

    while (queue.length > 0) {
        const current = queue.shift();
        enqueueIfFree(current.x + 1, current.y);
        enqueueIfFree(current.x - 1, current.y);
        enqueueIfFree(current.x, current.y + 1);
        enqueueIfFree(current.x, current.y - 1);
    }

    for (const cell of player.trail) {
        state.grid[cell.y][cell.x] = player.numId;
    }

    for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
            if (!blocked[y][x] && !visited[y][x]) {
                state.grid[y][x] = player.numId;
            }
        }
    }

    resetTrail(player);
    rebuildScores();
}

function pickupItem(player) {
    const index = state.items.findIndex((item) => item.x === player.x && item.y === player.y);
    if (index === -1) {
        return;
    }

    const item = state.items[index];
    state.items.splice(index, 1);

    if (item.type === 'boost') {
        player.boostUntil = Date.now() + BOOST_MS;
    }
    if (item.type === 'shield') {
        player.shieldUntil = Date.now() + SHIELD_MS;
    }
}

function spawnItemIfNeeded(now) {
    if (now < state.nextItemAt || state.items.length >= 4) {
        return;
    }

    for (let attempt = 0; attempt < 50; attempt += 1) {
        const x = randomInt(2, COLS - 3);
        const y = randomInt(2, ROWS - 3);
        const occupiedByPlayer = Array.from(state.players.values()).some((player) => player.alive && player.x === x && player.y === y);
        const occupiedByTrail = Array.from(state.players.values()).some((player) => player.trailSet.has(cellKey(x, y)));
        const occupiedByTerritory = state.grid[y][x] !== 0;
        const occupiedByItem = state.items.some((item) => item.x === x && item.y === y);

        if (!occupiedByPlayer && !occupiedByTrail && !occupiedByTerritory && !occupiedByItem) {
            const type = Math.random() < 0.5 ? 'boost' : 'shield';
            state.items.push({ id: state.nextItemId, type, x, y });
            state.nextItemId += 1;
            break;
        }
    }

    state.nextItemAt = now + randomInt(ITEM_MIN_MS, ITEM_MAX_MS);
}

function handleTrailCollisions(currentPlayer, now) {
    for (const target of state.players.values()) {
        if (!target.alive) {
            continue;
        }

        if (target.shieldUntil > now) {
            continue;
        }

        if (!target.trailSet.has(cellKey(currentPlayer.x, currentPlayer.y))) {
            continue;
        }

        if (target.numId === currentPlayer.numId) {
            killPlayer(currentPlayer, 'Tu as coupé ta propre trace.');
            return true;
        }

        killPlayer(target, `${currentPlayer.name} a coupé ta trace.`);
        return false;
    }

    return false;
}

function movePlayer(player, now) {
    if (!player.alive) {
        return;
    }

    const baseSteps = player.boostUntil > now ? 2 : 1;

    for (let step = 0; step < baseSteps; step += 1) {
        const chosen = chooseDirection(player.inputX, player.inputY, player.dirX, player.dirY);
        player.dirX = chosen.dx;
        player.dirY = chosen.dy;

        player.x += player.dirX;
        player.y += player.dirY;

        if (player.x <= 0 || player.x >= COLS - 1 || player.y <= 0 || player.y >= ROWS - 1) {
            killPlayer(player, 'Tu as touché le bord de la carte.');
            return;
        }

        const selfDied = handleTrailCollisions(player, now);
        if (selfDied || !player.alive) {
            return;
        }

        const owner = state.grid[player.y][player.x];

        if (owner === player.numId) {
            if (player.outside && player.trail.length > 0) {
                captureArea(player);
            } else {
                resetTrail(player);
            }
        } else {
            player.outside = true;
            addTrailCell(player, player.x, player.y);
        }

        pickupItem(player);
    }
}

function removeExpiredPlayers(now) {
    for (const [id, player] of state.players.entries()) {
        if (player.disconnectedAt && now - player.disconnectedAt > DISCONNECT_GRACE_MS) {
            clearPlayerTerritory(player);
            state.players.delete(id);
        }
    }
}

function respawnWaitingPlayers(now) {
    for (const player of state.players.values()) {
        if (!player.alive && player.respawnAt > 0 && now >= player.respawnAt) {
            respawnPlayer(player);
        }
    }
}

function buildPublicState() {
    rebuildScores();

    const players = Array.from(state.players.values())
        .map((player) => ({
            id: player.id,
            numId: player.numId,
            name: player.name,
            color: player.color,
            x: player.x,
            y: player.y,
            alive: player.alive,
            score: player.score,
            trail: player.trail,
            boost: player.boostUntil > Date.now(),
            shield: player.shieldUntil > Date.now(),
            disconnected: Boolean(player.disconnectedAt),
            lastDeathReason: player.lastDeathReason
        }))
        .sort((a, b) => b.score - a.score);

    return {
        cols: COLS,
        rows: ROWS,
        cellSize: CELL_SIZE,
        grid: state.grid,
        players,
        items: state.items,
        connectedPlayers: players.length,
        top5: players.slice(0, 5),
        controllerUrl: '/controller.html',
        elapsedMs: Date.now() - state.startedAt
    };
}

function emitState() {
    const publicState = buildPublicState();
    io.emit('state', publicState);

    for (const player of state.players.values()) {
        if (!player.socketId) {
            continue;
        }
        io.to(player.socketId).emit('selfState', {
            name: player.name,
            color: player.color,
            alive: player.alive,
            score: player.score,
            boost: player.boostUntil > Date.now(),
            shield: player.shieldUntil > Date.now(),
            lastDeathReason: player.lastDeathReason,
            disconnected: Boolean(player.disconnectedAt)
        });
    }
}

io.on('connection', (socket) => {
    socket.emit('welcome', {
        cols: COLS,
        rows: ROWS,
        cellSize: CELL_SIZE,
        colors: COLORS,
        controllerUrl: '/controller.html'
    });

    socket.on('joinGame', (payload, callback) => {
        const rawName = typeof payload?.name === 'string' ? payload.name.trim() : '';
        const name = rawName.length > 0 ? rawName.slice(0, 14) : `Joueur${state.nextPlayerNumId}`;
        const color = chooseColor(payload?.color);

        const player = {
            id: socket.id,
            socketId: socket.id,
            numId: state.nextPlayerNumId,
            name,
            color,
            x: 1,
            y: 1,
            dirX: 1,
            dirY: 0,
            inputX: 1,
            inputY: 0,
            alive: false,
            respawnAt: 0,
            lastDeathReason: '',
            trail: [],
            trailSet: new Set(),
            outside: false,
            score: 0,
            boostUntil: 0,
            shieldUntil: 0,
            disconnectedAt: 0
        };

        state.nextPlayerNumId += 1;
        state.players.set(player.id, player);
        state.socketToPlayer.set(socket.id, player.id);
        respawnPlayer(player);

        callback?.({
            ok: true,
            id: player.id,
            numId: player.numId,
            name: player.name,
            color: player.color
        });
    });

    socket.on('playerInput', (payload) => {
        const playerId = state.socketToPlayer.get(socket.id);
        if (!playerId) {
            return;
        }
        const player = state.players.get(playerId);
        if (!player) {
            return;
        }

        player.disconnectedAt = 0;
        player.socketId = socket.id;

        // Validation et normalisation des inputs
        const x = Number(payload?.x) || 0;
        const y = Number(payload?.y) || 0;
        player.inputX = Math.max(-1, Math.min(1, x));
        player.inputY = Math.max(-1, Math.min(1, y));
    });

    socket.on('disconnect', () => {
        const playerId = state.socketToPlayer.get(socket.id);
        state.socketToPlayer.delete(socket.id);

        if (!playerId) {
            return;
        }

        const player = state.players.get(playerId);
        if (!player) {
            return;
        }

        player.disconnectedAt = Date.now();
        player.socketId = null;
        player.inputX = 0;
        player.inputY = 0;
    });
});

setInterval(() => {
    const now = Date.now();
    removeExpiredPlayers(now);
    respawnWaitingPlayers(now);
    spawnItemIfNeeded(now);

    for (const player of state.players.values()) {
        if (player.disconnectedAt) {
            continue;
        }
        movePlayer(player, now);
    }
}, TICK_MS);

setInterval(() => {
    emitState();
}, STATE_MS);

server.listen(PORT, () => {
    console.log(`CHROMATRACE lancé sur http://localhost:${PORT}`);
});
