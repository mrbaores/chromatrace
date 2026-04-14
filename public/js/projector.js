// ========================================================
// CHROMATRACE - Rendu Phaser 3
// ========================================================

const socket = io();

const gameData = {
  cols: 100,
  rows: 80,
  cellSize: 16,
  state: null
};

// ========================================================
// 🎮 SCENE PHASER
// ========================================================

class ChromaScene extends Phaser.Scene {
  constructor() {
    super('ChromaScene');
    this.playerSprites = {};     // Sprites des cubes joueurs
    this.playerTexts = {};       // Noms des joueurs
    this.itemSprites = {};       // Sprites des items
    this.lastScores = {};        // Pour détecter les pickups
  }

  // ========================================================
  // 📦 PRELOAD - Chargement des ressources
  // ========================================================

  preload() {
    // Charge les spritesheets
    this.load.spritesheet('player_cubes', '/assets/sprites/player_cubes.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('items', '/assets/sprites/items.png', {
      frameWidth: 32,
      frameHeight: 32
    });

    // Affiche le nombre de frames disponibles pour debug
    this.load.on('complete', () => {
      const itemsTexture = this.textures.get('items');
      console.log(`✓ Items spritesheet: ${itemsTexture.frameTotal} frames`);
    });
  }

  // ========================================================
  // 🏗️ CREATE - Initialisation de la scène
  // ========================================================

  create() {
    // ===== COUCHES GRAPHIQUES =====
    this.background = this.add.graphics();
    this.gridGraphics = this.add.graphics();     // Territoires
    this.playerGraphics = this.add.graphics();   // Traînées
    this.uiGraphics = this.add.graphics();       // Arrière-plan UI

    // ===== TEXTES UI =====
    this.titleText = this.add.text(28, 18, 'CHROMATRACE', {
      fontFamily: 'Arial',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#06b6d4',
      strokeThickness: 3
    }).setDepth(10);

    this.infoText = this.add.text(28, 70, 'En attente de joueurs...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#a5f3fc'
    }).setDepth(10);

    this.helpText = this.add.text(28, 100, 'Accueil: /index-lobby.html', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1'
    }).setDepth(10);

    this.timerText = this.add.text(28, 130, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#e2e8f0'
    }).setDepth(10);

    this.instructionText = this.add.text(29, 160, 'En attente du lancement...', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#a5f3fc'
    }).setDepth(10);

    // ===== LEADERBOARD =====
    this.leaderboardTitle = this.add.text(1070, 24, 'TOP 5', {
      fontFamily: 'Arial',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#d946ef',
      strokeThickness: 2
    }).setOrigin(0.5, 0).setDepth(10);

    this.leaderLines = [];
    for (let i = 0; i < 5; i++) {
      const text = this.add.text(950, 80 + i * 40, `${i + 1}. ---`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#e2f3ff'
      }).setDepth(10);
      this.leaderLines.push(text);
    }

    // ===== SOCKET EVENTS =====
    socket.on('state', (payload) => {
      gameData.cols = payload.cols;
      gameData.rows = payload.rows;
      gameData.cellSize = payload.cellSize;
      gameData.state = payload;
    });

    // Redimensionne le canvas si la map change
    this.scale.setGameSize(
      gameData.cols * gameData.cellSize,
      gameData.rows * gameData.cellSize
    );

    this.drawBackground();
  }

  // ========================================================
  // 🎨 RENDU - Affichage à chaque frame
  // ========================================================

  update() {
    const state = gameData.state;
    if (!state) return;

    this.drawBackground();
    this.drawTerritories(state);
    this.updatePlayers(state);
    this.updateItems(state);
    this.drawUi(state);
  }

  // ========================================================
  // ✏️ DESSIN - Fond & Grille
  // ========================================================

  drawBackground() {
    this.background.clear();
    this.background.fillStyle(0x0f172a, 1);
    this.background.fillRect(0, 0, gameData.cols * gameData.cellSize, gameData.rows * gameData.cellSize);

    // Grille légère
    this.background.lineStyle(1, 0x12345a, 0.4);
    for (let x = 0; x <= gameData.cols; x++) {
      this.background.lineBetween(
        x * gameData.cellSize, 0,
        x * gameData.cellSize, gameData.rows * gameData.cellSize
      );
    }
    for (let y = 0; y <= gameData.rows; y++) {
      this.background.lineBetween(
        0, y * gameData.cellSize,
        gameData.cols * gameData.cellSize, y * gameData.cellSize
      );
    }
  }

  // ========================================================
  // 🗺️ RENDU - Territoires
  // ========================================================

  drawTerritories(state) {
    this.gridGraphics.clear();
    const colorMap = new Map(
      state.players.map(p => [p.numId, Phaser.Display.Color.HexStringToColor(p.color).color])
    );

    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const owner = state.grid[y][x];
        if (!owner) continue;

        const color = colorMap.get(owner) || 0xffffff;
        this.gridGraphics.fillStyle(color, 0.42);
        this.gridGraphics.fillRect(
          x * state.cellSize + 1,
          y * state.cellSize + 1,
          state.cellSize - 2,
          state.cellSize - 2
        );
      }
    }
  }

  // ========================================================
  // 👾 RENDU - Joueurs & Traînées
  // ========================================================

  updatePlayers(state) {
    this.playerGraphics.clear();
    const activePlayerIds = new Set();

    state.players.forEach(player => {
      activePlayerIds.add(player.numId);
      const colorObj = Phaser.Display.Color.HexStringToColor(player.color);
      const colorHex = colorObj.color;
      const colorHexStr = player.color;

      // ===== DESSIN TRAÎNÉE =====
      player.trail.forEach(cell => {
        this.playerGraphics.fillStyle(
          colorHex,
          player.shield ? 0.35 : 0.9
        );
        this.playerGraphics.fillRect(
          cell.x * state.cellSize + 4,
          cell.y * state.cellSize + 4,
          state.cellSize - 8,
          state.cellSize - 8
        );
      });

      // ===== JOUEUR MORT =====
      if (!player.alive) {
        if (this.playerSprites[player.numId]) {
          this.playerSprites[player.numId].destroy();
          delete this.playerSprites[player.numId];
        }
        if (this.playerTexts[player.numId]) {
          this.playerTexts[player.numId].destroy();
          delete this.playerTexts[player.numId];
        }
        return;
      }

      // ===== POSITION DU SPRITE =====
      const px = player.x * state.cellSize + state.cellSize / 2;
      const py = player.y * state.cellSize + state.cellSize / 2;

      // ===== CRÉATION OU MISE À JOUR SPRITE =====
      if (!this.playerSprites[player.numId]) {
        const sprite = this.add.sprite(px, py, 'player_cubes', 69).setDepth(5);
        sprite.setDisplaySize(state.cellSize * 1.5, state.cellSize * 1.5);
        sprite.setTint(colorHex);
        this.playerSprites[player.numId] = sprite;
      }

      const sprite = this.playerSprites[player.numId];
      sprite.setPosition(px, py);

      // Effets visuels: Boost & Shield
      if (player.boost) {
        sprite.setScale(1.3);
      } else {
        sprite.setScale(1);
      }

      if (player.shield) {
        sprite.setAlpha(0.6);
        // Aura de bouclier
        this.playerGraphics.lineStyle(2, 0xeab308, 0.9);
        this.playerGraphics.strokeCircle(px, py, state.cellSize * 1.2);
      } else {
        sprite.setAlpha(1);
      }

      // ===== AFFICHAGE DU NOM =====
      const nameY = py - state.cellSize - 10;

      if (!this.playerTexts[player.numId]) {
        const nameText = this.add.text(px, nameY, player.name, {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: colorHexStr,
          align: 'center',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(12);

        this.playerTexts[player.numId] = nameText;
      }

      const nameText = this.playerTexts[player.numId];
      nameText.setPosition(px, nameY);
      nameText.setText(player.name);
      nameText.setColor(colorHexStr);
    });

    // ===== NETTOYAGE JOUEURS DÉCONNECTÉS =====
    for (const id in this.playerSprites) {
      if (!activePlayerIds.has(Number(id))) {
        this.playerSprites[id].destroy();
        delete this.playerSprites[id];

        if (this.playerTexts[id]) {
          this.playerTexts[id].destroy();
          delete this.playerTexts[id];
        }
      }
    }
  }

  // ========================================================
  // 🎁 RENDU - Items
  // ========================================================

  updateItems(state) {
    const activeItemIds = new Set();

    state.items.forEach(item => {
      activeItemIds.add(item.id);

      const px = item.x * state.cellSize + state.cellSize / 2;
      const py = item.y * state.cellSize + state.cellSize / 2;

      if (!this.itemSprites[item.id]) {
        // ===== SÉLECTION FRAME =====
        let frameIndex = 0;
        const itemsTexture = this.textures.get('items');

        if (itemsTexture && itemsTexture.frameTotal > 0) {
          if (item.type === 'boost') {
            frameIndex = Math.min(1, itemsTexture.frameTotal - 1);
          } else {
            frameIndex = Math.min(3, itemsTexture.frameTotal - 1);
          }
        }

        // ===== CRÉATION SPRITE =====
        try {
          const sprite = this.add.sprite(px, py, 'items', frameIndex).setDepth(4);
          sprite.setDisplaySize(state.cellSize * 1.5, state.cellSize * 1.5);

          // Animation de flottement
          this.tweens.add({
            targets: sprite,
            y: py - 5,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut'
          });

          this.itemSprites[item.id] = sprite;
        } catch (e) {
          console.warn(`⚠ Erreur création sprite item ${item.id}:`, e.message);
        }
      }
    });

    // ===== NETTOYAGE ITEMS RAMASSÉS =====
    for (const id in this.itemSprites) {
      if (!activeItemIds.has(Number(id))) {
        this.itemSprites[id].destroy();
        delete this.itemSprites[id];
        SoundManager.playPickup();
      }
    }
  }

  // ========================================================
  // 📊 RENDU - UI (Leaderboard, Timer)
  // ========================================================

  drawUi(state) {
    this.uiGraphics.clear();

    // ===== BOÎTE INFO (gauche) =====
    this.uiGraphics.fillStyle(0x020617, 0.82);
    this.uiGraphics.fillRoundedRect(10, 10, 510, 180, 18);
    this.uiGraphics.lineStyle(2, 0x06b6d4, 0.75);
    this.uiGraphics.strokeRoundedRect(10, 10, 510, 180, 18);

    // ===== BOÎTE LEADERBOARD (droite) =====
    this.uiGraphics.fillStyle(0x020617, 0.84);
    this.uiGraphics.fillRoundedRect(915, 10, 350, 290, 18);
    this.uiGraphics.lineStyle(2, 0xd946ef, 0.75);
    this.uiGraphics.strokeRoundedRect(915, 10, 350, 290, 18);

    // ===== TIMER =====
    const minutes = Math.floor(state.elapsedMs / 60000);
    const seconds = Math.floor((state.elapsedMs % 60000) / 1000);
    const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // ===== MÀJ TEXTES =====
    this.infoText.setText(`Joueurs: ${state.connectedPlayers} | Temps: ${clock}`);
    this.helpText.setText(`URL: http://${window.location.host}/controller.html`);

    // ===== LEADERBOARD =====
    if (state.top5 && state.top5.length > 0) {
      this.leaderLines.forEach((line, index) => {
        const player = state.top5[index];
        if (!player) {
          line.setText(`${index + 1}. ---`);
          line.setColor('#e2f3ff');
          return;
        }

        const score = Math.round((player.score / 8000) * 100);
        line.setText(`${index + 1}. ${player.name} (${score}%)`);
        line.setColor(player.color);
      });
    }
  }
}

// ========================================================
// 🎮 CONFIGURATION PHASER
// ========================================================

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0f172a',
  scene: [ChromaScene],
  parent: document.getElementById('game-canvas'),
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// ========================================================
// 🚀 LANCEMENT
// ========================================================

window.addEventListener('load', () => {
  new Phaser.Game(config);
});
