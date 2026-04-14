const socket = io();

const gameData = {
    cols: 80,
    rows: 45,
    cellSize: 16,
    state: null
};

class ChromaScene extends Phaser.Scene {
    constructor() {
        super('ChromaScene');
        // On prépare des dictionnaires pour stocker nos sprites sans les recréer
        this.playerSprites = {}; 
        this.itemSprites = {};
    }

    // -------------------------------------------------------
    // 1. CHARGEMENT DES IMAGES (SPRITESHEETS)
    // -------------------------------------------------------
    preload() {
        // Chargement des spritesheets depuis le dossier assets
        this.load.spritesheet('player_cubes', '/assets/sprites/player_cubes.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('items', '/assets/sprites/items.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        this.background = this.add.graphics();
        this.gridGraphics = this.add.graphics();
        this.playerGraphics = this.add.graphics(); // On garde le Graphics juste pour la traînée
        this.uiGraphics = this.add.graphics();

        // UI - Titres
        this.titleText = this.add.text(28, 18, 'CHROMATRACE', {
            fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold',
            color: '#ffffff', stroke: '#06b6d4', strokeThickness: 3
        }).setDepth(10);

        this.infoText = this.add.text(28, 70, 'En attente de joueurs...', {
            fontFamily: 'Arial', fontSize: '20px', color: '#a5f3fc'
        }).setDepth(10);

        this.helpText = this.add.text(28, 100, 'Ouvre /controller.html sur ton téléphone pour rejoindre.', {
            fontFamily: 'Arial', fontSize: '18px', color: '#cbd5e1'
        }).setDepth(10);

        this.timerText = this.add.text(28, 130, '', {
            fontFamily: 'Arial', fontSize: '18px', color: '#e2e8f0'
        }).setDepth(10);

        // Correction du bug de syntaxe ici (guillemets ajoutés autour de la couleur)
        this.instructionText = this.add.text(29, 160, 'Instruction du joueur', { 
            fontFamily: 'Arial', fontSize: '18px', color: '#a5f3fc' 
        }).setDepth(10);

        // UI - Leaderboard
        this.leaderboardTitle = this.add.text(1070, 24, 'TOP 5', {
            fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold',
            color: '#ffffff', stroke: '#d946ef', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10);

        this.leaderLines = [];
        for (let i = 0; i < 5; i += 1) {
            const text = this.add.text(950, 80 + i * 40, `${i + 1}. ---`, {
                fontFamily: 'Arial', fontSize: '20px', color: '#e2f3ff'
            }).setDepth(10);
            this.leaderLines.push(text);
        }

        socket.on('state', (payload) => {
            gameData.cols = payload.cols;
            gameData.rows = payload.rows;
            gameData.cellSize = payload.cellSize;
            gameData.state = payload;
        });

        this.drawBackground();
    }

    drawBackground() {
        this.background.clear();
        this.background.fillStyle(0x0f172a, 1);
        this.background.fillRect(0, 0, 1280, 720);

        this.background.lineStyle(1, 0x12345a, 0.4);
        for (let x = 0; x <= gameData.cols; x += 1) {
            this.background.lineBetween(x * gameData.cellSize, 0, x * gameData.cellSize, gameData.rows * gameData.cellSize);
        }
        for (let y = 0; y <= gameData.rows; y += 1) {
            this.background.lineBetween(0, y * gameData.cellSize, gameData.cols * gameData.cellSize, y * gameData.cellSize);
        }
    }

    update() {
        const state = gameData.state;
        if (!state) return;

        this.drawTerritories(state);
        this.updatePlayers(state); // Remplacé: gère les sprites ET les traînées
        this.updateItems(state);   // Remplacé: gère les sprites d'items
        this.drawUi(state);
    }

    drawTerritories(state) {
        this.gridGraphics.clear();
        const colorMap = new Map(state.players.map((player) => [player.numId, Phaser.Display.Color.HexStringToColor(player.color).color]));

        for (let y = 0; y < state.rows; y += 1) {
            for (let x = 0; x < state.cols; x += 1) {
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

    // -------------------------------------------------------
    // 2. GESTION OPTIMISÉE DES JOUEURS (SPRITES + TRAÎNÉES)
    // -------------------------------------------------------
    updatePlayers(state) {
        // On nettoie la traînée (c'est normal de le faire à chaque frame pour les lignes)
        this.playerGraphics.clear();
        const activePlayerIds = new Set();

        state.players.forEach((player) => {
            activePlayerIds.add(player.numId);
            const colorObj = Phaser.Display.Color.HexStringToColor(player.color);
            const colorHex = colorObj.color;

            // --- 1. Dessin de la traînée (Graphics) ---
            player.trail.forEach((cell) => {
                this.playerGraphics.fillStyle(colorHex, player.shield ? 0.35 : 0.9);
                this.playerGraphics.fillRect(
                    cell.x * state.cellSize + 4,
                    cell.y * state.cellSize + 4,
                    state.cellSize - 8,
                    state.cellSize - 8
                );
            });

            if (!player.alive) {
                // Si le joueur est mort, on supprime son sprite s'il existe
                if (this.playerSprites[player.numId]) {
                    this.playerSprites[player.numId].destroy();
                    delete this.playerSprites[player.numId];
                }
                return;
            }

            // --- 2. Mise à jour ou Création du Sprite Joueur ---
            const px = player.x * state.cellSize + state.cellSize / 2;
            const py = player.y * state.cellSize + state.cellSize / 2;

            if (!this.playerSprites[player.numId]) {
                // Création du sprite (on utilise l'index 69 qui semble être le cube blanc dans ton image pour le colorer)
                // Tu peux changer le '69' par l'index du cube gris/blanc dans ta planche
                const sprite = this.add.sprite(px, py, 'player_cubes', 69).setDepth(5);
                sprite.setDisplaySize(state.cellSize * 1.5, state.cellSize * 1.5);
                
                // On applique la couleur choisie par le joueur sur le cube blanc !
                sprite.setTint(colorHex);
                
                this.playerSprites[player.numId] = sprite;
            }

            const sprite = this.playerSprites[player.numId];
            sprite.setPosition(px, py);

            // Gestion des effets visuels (Boost et Shield)
            if (player.boost) {
                sprite.setScale(1.3); // Grossit si boost
            } else {
                sprite.setScale(1);
            }

            if (player.shield) {
                sprite.setAlpha(0.6); // Devient transparent si bouclier
                // Ajout d'une aura jaune pour le bouclier
                this.playerGraphics.lineStyle(2, 0xeab308, 0.9);
                this.playerGraphics.strokeCircle(px, py, state.cellSize * 1.2);
            } else {
                sprite.setAlpha(1);
            }
        });

        // Nettoyage des joueurs déconnectés
        for (const id in this.playerSprites) {
            if (!activePlayerIds.has(Number(id))) {
                this.playerSprites[id].destroy();
                delete this.playerSprites[id];
            }
        }
    }

    // -------------------------------------------------------
    // 3. GESTION DES ITEMS AVEC SPRITES
    // -------------------------------------------------------
    updateItems(state) {
        const activeItemIds = new Set();

        state.items.forEach((item, index) => {
            // On utilise un index "virtuel" car ton state n'a pas d'ID d'item unique
            const itemId = `${item.x}-${item.y}-${item.type}`; 
            activeItemIds.add(itemId);

            const px = item.x * state.cellSize + state.cellSize / 2;
            const py = item.y * state.cellSize + state.cellSize / 2;

            if (!this.itemSprites[itemId]) {
                // Index des frames (à ajuster selon ta planche items.png)
                // Ex: 1 = Potion (Boost), 3 = Bouclier (Shield)
                const frameIndex = item.type === 'boost' ? 1 : 3; 
                
                const sprite = this.add.sprite(px, py, 'items', frameIndex).setDepth(4);
                sprite.setDisplaySize(state.cellSize * 1.5, state.cellSize * 1.5);

                // Petite animation de flottement haut-bas
                this.tweens.add({
                    targets: sprite,
                    y: py - 5,
                    duration: 600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.inOut'
                });

                this.itemSprites[itemId] = sprite;
            }
        });

        // Supprime les sprites des items ramassés
        for (const id in this.itemSprites) {
            if (!activeItemIds.has(id)) {
                this.itemSprites[id].destroy();
                delete this.itemSprites[id];
            }
        }
    }

    drawUi(state) {
        this.uiGraphics.clear();
        this.uiGraphics.fillStyle(0x020617, 0.82);
        this.uiGraphics.fillRoundedRect(10, 10, 510, 180, 18); // Agrandi un peu pour ton nouveau texte
        this.uiGraphics.lineStyle(2, 0x06b6d4, 0.75);
        this.uiGraphics.strokeRoundedRect(10, 10, 510, 180, 18);

        this.uiGraphics.fillStyle(0x020617, 0.84);
        this.uiGraphics.fillRoundedRect(915, 10, 350, 290, 18);
        this.uiGraphics.lineStyle(2, 0xd946ef, 0.75);
        this.uiGraphics.strokeRoundedRect(915, 10, 350, 290, 18);

        const minutes = Math.floor(state.elapsedMs / 60000);
        const seconds = Math.floor((state.elapsedMs % 60000) / 1000);
        const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        this.infoText.setText(`Joueurs connectés : ${state.connectedPlayers}`);
        this.helpText.setText(`Téléphones : ${window.location.origin}${state.controllerUrl}`);
        this.timerText.setText(`Temps de partie : ${clock}`);

        this.leaderLines.forEach((line, index) => {
            const player = state.top5[index];
            if (!player) {
                line.setText(`${index + 1}. ---`);
                line.setColor('#e2f3ff');
                return;
            }
            line.setText(`${index + 1}. ${player.name} - ${player.score}`);
            line.setColor(player.color);
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: '#0f172a',
    scene: [ChromaScene],
    parent: document.body,
    pixelArt: false
};

window.addEventListener('load', () => {
    new Phaser.Game(config);
});