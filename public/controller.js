const socket = io();

const joinScreen = document.getElementById('join-screen');
const playScreen = document.getElementById('play-screen');
const joinButton = document.getElementById('join-button');
const joinMessage = document.getElementById('join-message');
const playerNameInput = document.getElementById('player-name');
const colorList = document.getElementById('color-list');

const hudName = document.getElementById('hud-name');
const hudScore = document.getElementById('hud-score');
const hudStatus = document.getElementById('hud-status');
const boostBadge = document.getElementById('status-boost');
const shieldBadge = document.getElementById('status-shield');

const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');

let selectedColor = '#06b6d4';
let joined = false;
let pointerActive = false;
let inputVector = { x: 0, y: 0 };

socket.on('welcome', (payload) => {
    renderColors(payload.colors || []);
});

socket.on('selfState', (payload) => {
    hudName.textContent = payload.name;
    hudScore.textContent = payload.score;

    if (payload.disconnected) {
        hudStatus.textContent = 'Déconnecté';
    } else if (!payload.alive) {
        hudStatus.textContent = 'Respawn...';
    } else {
        hudStatus.textContent = 'Vivant';
    }

    boostBadge.textContent = payload.boost ? 'Boost ON' : 'Boost OFF';
    shieldBadge.textContent = payload.shield ? 'Shield ON' : 'Shield OFF';

    boostBadge.style.borderColor = payload.boost ? '#84cc16' : 'rgba(255,255,255,0.15)';
    shieldBadge.style.borderColor = payload.shield ? '#eab308' : 'rgba(255,255,255,0.15)';

    if (payload.lastDeathReason && !payload.alive) {
        joinMessage.textContent = payload.lastDeathReason;
    }
});

function renderColors(colors) {
    colorList.innerHTML = '';
    colors.forEach((color, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'color-option';
        button.style.background = color;
        if (index === 0) {
            button.classList.add('selected');
            selectedColor = color;
        }

        button.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach((node) => node.classList.remove('selected'));
            button.classList.add('selected');
            selectedColor = color;
        });

        colorList.appendChild(button);
    });
}

joinButton.addEventListener('click', () => {
    if (joined) {
        return;
    }

    const name = playerNameInput.value.trim();
    socket.emit('joinGame', { name, color: selectedColor }, (response) => {
        if (!response?.ok) {
            joinMessage.textContent = 'Impossible de rejoindre la partie.';
            return;
        }

        joined = true;
        joinScreen.classList.add('hidden');
        playScreen.classList.remove('hidden');
        joinMessage.textContent = '';
    });
});

function setKnob(x, y) {
    const radius = joystickBase.clientWidth / 2;
    joystickKnob.style.left = `${radius + x * radius * 0.6}px`;
    joystickKnob.style.top = `${radius + y * radius * 0.6}px`;
}

function updateVectorFromPointer(clientX, clientY) {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const radius = rect.width / 2;
    const distance = Math.hypot(dx, dy);

    if (distance > radius) {
        const factor = radius / distance;
        dx *= factor;
        dy *= factor;
    }

    inputVector.x = dx / radius;
    inputVector.y = dy / radius;
    setKnob(inputVector.x, inputVector.y);
}

function resetJoystick() {
    inputVector.x = 0;
    inputVector.y = 0;
    setKnob(0, 0);
}

joystickBase.addEventListener('pointerdown', (event) => {
    pointerActive = true;
    joystickBase.setPointerCapture(event.pointerId);
    updateVectorFromPointer(event.clientX, event.clientY);
});

joystickBase.addEventListener('pointermove', (event) => {
    if (!pointerActive) {
        return;
    }
    updateVectorFromPointer(event.clientX, event.clientY);
});

function stopPointer() {
    pointerActive = false;
    resetJoystick();
}

joystickBase.addEventListener('pointerup', stopPointer);
joystickBase.addEventListener('pointercancel', stopPointer);
joystickBase.addEventListener('pointerleave', () => {
    if (pointerActive) {
        stopPointer();
    }
});

setInterval(() => {
    if (!joined) {
        return;
    }
    socket.emit('playerInput', inputVector);
}, 50);

resetJoystick();
