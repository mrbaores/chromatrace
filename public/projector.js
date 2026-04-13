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

    create() {
        this.background = this.add.graphics();
        this.gridGraphics = this.add.graphics();
        this.itemGraphics = this.add.graphics();
        this.playerGraphics = this.add.graphics();
        this.uiGraphics = this.add.graphics();

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

        this.helpText = this.add.text(28, 100, 'Ouvre /controller.html sur ton téléphone pour rejoindre.', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#cbd5e1'
        }).setDepth(10);

        this.timerText = this.add.text(28, 130, '', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#e2e8f0'
        }).setDepth(10);

        this.infoText= this.add.text(29,100,'Instruction du jouer ' ,{ 
            fontFamily :'Arial',
            fontSize :'18px',
            color :  #a5f3fc }).setDepth(10);
        

        this.leaderboardTitle = this.add.text(1070, 24, 'TOP 5', {
            fontFamily: 'Arial',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#d946ef',
            strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10);

        this.leaderLines = [];
        for (let i = 0; i < 5; i += 1) {
            const text = this.add.text(950, 80 + i * 40, `${i + 1}. ---`, {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#e2f3ff'
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
        this.drawBackground();

        if (!state) {
            return;
        }

        this.drawTerritories(state);
        this.drawItems(state);
        this.drawPlayers(state);
        this.drawUi(state);
    }

    drawTerritories(state) {
        this.gridGraphics.clear();
        const colorMap = new Map(state.players.map((player) => [player.numId, Phaser.Display.Color.HexStringToColor(player.color).color]));

        for (let y = 0; y < state.rows; y += 1) {
            for (let x = 0; x < state.cols; x += 1) {
                const owner = state.grid[y][x];
                if (!owner) {
                    continue;
                }

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
        this.itemGraphics.clear();
        state.items.forEach((item) => {
            const x = item.x * state.cellSize + state.cellSize / 2;
            const y = item.y * state.cellSize + state.cellSize / 2;
            const color = item.type === 'boost' ? 0x84cc16 : 0xeab308;
            this.itemGraphics.fillStyle(color, 1);
            this.itemGraphics.lineStyle(2, 0xffffff, 0.9);

            if (item.type === 'boost') {
                this.itemGraphics.fillTriangle(x - 6, y + 8, x + 2, y + 2, x - 2, y - 2);
                this.itemGraphics.fillTriangle(x - 2, y - 2, x + 6, y - 8, x + 2, y + 2);
            } else {
                this.itemGraphics.strokeCircle(x, y, 7);
                this.itemGraphics.lineBetween(x, y - 8, x + 7, y);
                this.itemGraphics.lineBetween(x + 7, y, x, y + 8);
                this.itemGraphics.lineBetween(x, y + 8, x - 7, y);
                this.itemGraphics.lineBetween(x - 7, y, x, y - 8);
            }
        });
    }

    drawPlayers(state) {
        this.playerGraphics.clear();

        state.players.forEach((player) => {
            const color = Phaser.Display.Color.HexStringToColor(player.color).color;

            player.trail.forEach((cell) => {
                this.playerGraphics.fillStyle(color, player.shield ? 0.35 : 0.9);
                this.playerGraphics.fillRect(
                    cell.x * state.cellSize + 4,
                    cell.y * state.cellSize + 4,
                    state.cellSize - 8,
                    state.cellSize - 8
                );
            });

            if (!player.alive) {
                return;
            }

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

    drawUi(state) {
        this.uiGraphics.clear();
        this.uiGraphics.fillStyle(0x020617, 0.82);
        this.uiGraphics.fillRoundedRect(10, 10, 510, 150, 18);
        this.uiGraphics.lineStyle(2, 0x06b6d4, 0.75);
        this.uiGraphics.strokeRoundedRect(10, 10, 510, 150, 18);

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
