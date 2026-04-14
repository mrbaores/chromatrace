// ========================================================
// CHROMATRACE - Gestionnaire du Lobby
// ========================================================

const LobbyManager = (() => {
  // ===== ÉTAT DU LOBBY =====
  const state = {
    players: [],
    gameDuration: 180, // 3 minutes en secondes
    itemsEnabled: true,
    boostEnabled: true,
    gameStarted: false,
    gameEndTime: null,
    elapsedMs: 0
  };

  const socket = io();

  // ===== ÉLÉMENTS DOM =====
  const lobbyScreen = document.getElementById('lobby-screen');
  const gameCanvas = document.getElementById('game-canvas');
  const hud = document.getElementById('hud');
  const endScreen = document.getElementById('end-screen');

  const playerCountNum = document.getElementById('player-count-num');
  const playerList = document.getElementById('player-list');
  const durationDisplay = document.getElementById('duration-display');
  const itemsToggle = document.getElementById('items-toggle');
  const boostToggle = document.getElementById('boost-toggle');
  const startBtn = document.getElementById('start-btn');
  const timerDisplay = document.getElementById('timer-display');
  const serverUrl = document.getElementById('server-url');

  // ========================================================
  // 🔌 SOCKET.IO EVENTS
  // ========================================================

  socket.on('connect', () => {
    console.log('✓ Connecté au serveur');
    updateServerUrl();
  });

  // Mets à jour la liste des joueurs en temps réel
  socket.on('playerJoined', (playersData) => {
    state.players = playersData;
    updatePlayerList();
    updateStartButton();
  });

  socket.on('playerLeft', (playersData) => {
    state.players = playersData;
    updatePlayerList();
  });

  // Reçoit les mises à jour d'état pendant le jeu
  socket.on('state', (gameState) => {
    if (!state.gameStarted) return;

    state.elapsedMs = gameState.elapsedMs;
    updateTimer(gameState.elapsedMs);
    updateLeaderboard(gameState.top5);

    // Vérifie si la partie est finie
    if (gameState.elapsedMs >= state.gameDuration * 1000) {
      endGame(gameState.top5);
    }
  });

  socket.on('gameStarted', (config) => {
    state.gameStarted = true;
    state.gameDuration = config.gameDuration;
    startGameUI();
  });

  // ========================================================
  // 🎮 GESTION DE L'INTERFACE LOBBY
  // ========================================================

  /**
   * Mets à jour l'affichage de la liste des joueurs
   */
  function updatePlayerList() {
    playerCountNum.textContent = state.players.length;
    playerList.innerHTML = '';

    state.players.forEach((player) => {
      const entry = document.createElement('div');
      entry.className = 'player-entry';
      entry.style.setProperty('--player-color', player.color);

      entry.innerHTML = `
        <div class="player-dot"></div>
        <div class="player-name">${player.name}</div>
      `;

      playerList.appendChild(entry);
    });
  }

  /**
   * Affiche l'URL du serveur pour les clients mobiles
   */
  function updateServerUrl() {
    const host = window.location.hostname;
    const port = window.location.port || 80;
    const url = `${host}:${port}/controller.html`;
    serverUrl.textContent = url;
  }

  /**
   * Active/désactive le bouton de lancement selon le nombre de joueurs
   */
  function updateStartButton() {
    const minPlayers = 2;
    const enabled = state.players.length >= minPlayers && !state.gameStarted;
    startBtn.disabled = !enabled;
  }

  /**
   * Change la durée du jeu
   */
  function changeDuration(delta) {
    const min = 180; // 3 min
    const max = 600; // 10 min
    state.gameDuration = Math.max(min, Math.min(max, state.gameDuration + delta));
    updateDurationDisplay();
  }

  /**
   * Affiche la durée au format MM:SS
   */
  function updateDurationDisplay() {
    const minutes = Math.floor(state.gameDuration / 60);
    const seconds = state.gameDuration % 60;
    durationDisplay.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Bascule l'affichage des items
   */
  function toggleItems() {
    state.itemsEnabled = !state.itemsEnabled;
    itemsToggle.classList.toggle('on');
    itemsToggle.textContent = state.itemsEnabled ? 'ON' : 'OFF';
  }

  /**
   * Bascule le boost de vitesse
   */
  function toggleBoost() {
    state.boostEnabled = !state.boostEnabled;
    boostToggle.classList.toggle('on');
    boostToggle.textContent = state.boostEnabled ? 'ON' : 'OFF';
  }

  /**
   * Lance la partie depuis le serveur
   */
  function startGame() {
    if (state.players.length < 2) {
      alert('Au moins 2 joueurs sont nécessaires');
      return;
    }

    socket.emit('startGame', {
      gameDuration: state.gameDuration,
      itemsEnabled: state.itemsEnabled,
      boostEnabled: state.boostEnabled
    });
  }

  // ========================================================
  // 🎮 GESTION DU JEU EN COURS
  // ========================================================

  /**
   * Bascule vers l'interface de jeu
   */
  function startGameUI() {
    // Masque le lobby, affiche le jeu et le HUD
    lobbyScreen.style.display = 'none';
    gameCanvas.classList.add('visible');
    hud.classList.add('visible');

    // Initialise Phaser (appelé par projector.js)
    SoundManager.playAmbient();
  }

  /**
   * Met à jour l'affichage du timer
   */
  function updateTimer(elapsedMs) {
    const remainingMs = (state.gameDuration * 1000) - elapsedMs;
    const seconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    const timerText = `${minutes}:${String(secs).padStart(2, '0')}`;
    timerDisplay.textContent = timerText;

    // Style urgent si moins de 30 secondes
    if (seconds <= 30) {
      timerDisplay.classList.add('urgent');
    } else {
      timerDisplay.classList.remove('urgent');
    }
  }

  /**
   * Met à jour le classement en temps réel
   */
  function updateLeaderboard(top5) {
    const lbEntries = document.getElementById('lb-entries');
    lbEntries.innerHTML = '';

    if (!top5 || top5.length === 0) return;

    top5.forEach((player, index) => {
      const entry = document.createElement('div');
      entry.className = 'lb-entry';

      const scorePercent = Math.round((player.score / 8000) * 100); // 8000 = max cells

      entry.innerHTML = `
        <div class="lb-rank">#${index + 1}</div>
        <div class="lb-color-dot" style="background: ${player.color}"></div>
        <div class="lb-pseudo">${player.name}</div>
        <div class="lb-score">${scorePercent}%</div>
      `;

      lbEntries.appendChild(entry);
    });
  }

  /**
   * Affiche l'écran de fin de partie avec le podium
   */
  function endGame(topPlayers) {
    state.gameStarted = false;
    hud.classList.remove('visible');
    endScreen.classList.add('visible');

    const podium = document.getElementById('podium');
    podium.innerHTML = '';

    // Affiche les 3 premiers (ou moins si moins de joueurs)
    topPlayers.slice(0, 3).forEach((player, index) => {
      const podiumEntry = document.createElement('div');
      podiumEntry.className = 'podium-entry';

      // Calcule la place (podium)
      const placeMult = [1.4, 1, 1.2]; // 1er, 2e, 3e place
      const cubeHeight = 100 * (placeMult[index] || 1);

      const scorePercent = Math.round((player.score / 8000) * 100);

      podiumEntry.innerHTML = `
        <div class="podium-cube" style="background: ${player.color}; height: ${cubeHeight}px; --podium-color: ${player.color}">
          ${index + 1}
        </div>
        <div class="podium-name">${player.name}</div>
        <div class="podium-territory">${scorePercent}%</div>
      `;

      podium.appendChild(podiumEntry);
    });
  }

  /**
   * Réinitialise et revient au lobby
   */
  function resetGame() {
    state.gameStarted = false;
    lobbyScreen.style.display = 'flex';
    gameCanvas.classList.remove('visible');
    hud.classList.remove('visible');
    endScreen.classList.remove('visible');

    // Remet le canvas Phaser à vide
    document.getElementById('game-canvas').innerHTML = '';

    location.reload(); // Recharge pour remettre à zéro
  }

  // ========================================================
  // 📦 API PUBLIQUE
  // ========================================================

  return {
    // Gestion lobby
    changeDuration,
    toggleItems,
    toggleBoost,
    startGame,

    // Gestion jeu
    updateTimer,
    updateLeaderboard,
    endGame: endGame,
    resetGame,

    // Utilitaires
    getState: () => state,
    getSocket: () => socket
  };
})();

// Initialise les affichages au chargement
window.addEventListener('load', () => {
  LobbyManager.updateDurationDisplay = () => {
    const minutes = Math.floor(LobbyManager.getState().gameDuration / 60);
    const seconds = LobbyManager.getState().gameDuration % 60;
    document.getElementById('duration-display').textContent =
      `${minutes}:${String(seconds).padStart(2, '0')}`;
  };
  LobbyManager.updateDurationDisplay();
});
