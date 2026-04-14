# CHROMATRACE - Jeu Multijoueur Colocalisé

## 🎮 Vue d'ensemble
CHROMATRACE est un jeu massivement multijoueur colocalisé (30+ joueurs) combinant des contrôles mobiles en temps réel avec un affichage partagé sur grand écran.

## 📁 Architecture du Projet

```
chromatrace/
├── server.js                 # Serveur Node.js + Socket.io (cœur du jeu)
├── package.json             # Dépendances du projet
├── README.md                # Documentation
│
└── public/                  # Fichiers web statiques
    ├── index.html          # Page projecteur (affichage groupe)
    ├── controller.html     # Page manette (téléphone)
    │
    ├── assets/             # Ressources (images, styles)
    │   ├── sprites/        # Spritesheets Phaser
    │   │   ├── player_cubes.png
    │   │   └── items.png
    │   └── styles/         # Feuilles de style
    │       └── style.css
    │
    └── js/                 # Code JavaScript
        ├── projector.js    # Rendu Phaser (affichage)
        └── controller.js   # Contrôle mobile (joystick)
```

## 🚀 Démarrage

```bash
npm install
npm start
# Serveur lancé sur http://localhost:3000
```

**Affichage projecteur:** http://localhost:3000/
**Manette mobile:** http://localhost:3000/controller.html

## 🎯 Caractéristiques

- **30+ joueurs simultanés** avec gestion robuste
- **16 couleurs neon** pour identifier les joueurs
- **Joystick mobile** avec feedback visuel
- **Capture de territoire** avec algorithme Flood Fill
- **Items bonus:** Boost (2x vitesse) et Shield (protection)
- **Leaderboard TOP 5** en temps réel
- **Interface Cyber-Neon** avec animations

## 🔧 Optimisations

1. **14 spawn points** répartis sur la map
2. **16 couleurs neon** distinctes
3. **Validation inputs** pour stabilité
4. **Gestion d'erreurs** et timeout
5. **Performance optimisée** pour 30+ joueurs
