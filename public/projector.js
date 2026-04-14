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
    }

    preload() {
        this.load.image('img-boost', 'assets/boost.png');
        this.load.image('img-shield', 'assets/shield.png');
    }

    create() {
        this.background = this.add.graphics();
        this.gridGraphics = this.add.graphics();
        this.playerGraphics = this.add.graphics();
        this.itemSprites = this.add.group(); 

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
        this.drawBackground();

        if (!state) return;

        this.drawTerritories(state);
        this.drawItems(state);
        this.drawPlayers(state);
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

    drawItems(state) {
        this.itemSprites.clear(true, true);

        state.items.forEach((item) => {
            const x = item.x * state.cellSize + state.cellSize / 2;
            const y = item.y * state.cellSize + state.cellSize / 2;
            
            const textureName = item.type === 'boost' ? 'img-boost' : 'img-shield';
            
            const sprite = this.add.sprite(x, y, textureName);
            
            sprite.setDisplaySize(state.cellSize * 1.5, state.cellSize * 1.5);
            
            this.itemSprites.add(sprite);
        });
    }

    drawPlayers(state) {
        this.playerGraphics.clear();

        state.players.forEach((player) => {
            const color = Phaser.Display.Color.HexStringToColor(player.color).color;

            player.trail.forEach((cell) => {
                this.playerGraphics.fillStyle(color, player.shield ? 0.35 : 0.9);
                this.playerGraphics.fillRect(cell.x * state.cellSize + 4, cell.y * state.cellSize + 4, state.cellSize - 8, state.cellSize - 8);
            });

            if (!player.alive) return;

            const px = player.x * state.cellSize + state.cellSize / 2;
            const py = player.y * state.cellSize + state.cellSize / 2;
            this.playerGraphics.fillStyle(color, 1);
            this.playerGraphics.fillCircle(px, py, state.cellSize * 0.42);
            this.playerGraphics.lineStyle(2, 0xffffff, 0.9);
            this.playerGraphics.strokeCircle(px, py, state.cellSize * 0.45);

            if (player.boost) {
                this.playerGraphics.lineStyle(2, 0x84cc16, 0.9);
                this.playerGraphics.strokeCircle(px, py, state.cellSize * 0.65);
            }
            if (player.shield) {
                this.playerGraphics.lineStyle(2, 0xeab308, 0.9);
                this.playerGraphics.strokeCircle(px, py, state.cellSize * 0.8);
            }
        });
    }
}

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720
    },
    transparent: true,
    scene: [ChromaScene],
    parent: 'game-canvas',
    pixelArt: true 
};

window.addEventListener('load', () => {
    new Phaser.Game(config);
});