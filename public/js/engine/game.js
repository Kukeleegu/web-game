// Game Engine

class GameEngine {
    constructor(gameArea, socket, gameMode = "survival", initialGameStartTime = null) {
        this.gameArea = gameArea;
        this.socket = socket;
        this.gameMode = gameMode;
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;

        // Game state
        this.players = new Map();
        this.projectiles = new Map();
        this.effects = new Map();
        this.walls = [];
        this.zombies = new Map();
        this.npc = new Map();
        this.localPlayerId = null;
        this.currentLobbyId = null;
        this.abilityCooldowns = new Map();
        this.scoreboardUpdateCounter = 0;
        this.gameStartTime = initialGameStartTime;
        this.gameDuration = 900000; // 15 minutes (will be adjusted per game mode)

        // Set game duration based on game mode
        if (this.gameMode === "survival") {
            this.gameDuration = 900000; // 15 minutes for survival
        } else {
            this.gameDuration = 300000; // 5 minutes for deathmatch
        }

        // Input handling
        this.keys = new Set();

        // Rendering
        this.renderer = new GameRenderer(gameArea);
        this.renderer.setGameEngine(this); // Set reference for effect rendering

        // Fixed world size for consistent gameplay across different screen sizes
        this.worldWidth = 1200;
        this.worldHeight = 800;

        // Sound system
        this.soundManager = new SoundManager();

        // Physics system
        this.physics = new Physics();

        // Camera system
        this.camera = new Camera(gameArea, this.worldWidth, this.worldHeight);

        // Player management system
        this.playerManager = new PlayerManager(this.players, this.localPlayerId, this.keys, this.camera);

        // Effect management system
        this.effectManager = new EffectManager(this.effects);

        // Projectile management system
        this.projectileManager = new ProjectileManager(this.projectiles, this.walls, this.physics, this.effectManager.addEffect.bind(this.effectManager), this.zombies);

        // Weapon system
        this.weaponSystem = new WeaponSystem(
            this.players,
            this.localPlayerId,
            this.isRunning,
            this.isPaused,
            this.getMouseState.bind(this),
            this.projectileManager,
            this.effectManager,
            this.socket,
            this.soundManager
        );

        // Ability system
        this.abilitySystem = new AbilitySystem(
            this.players,
            this.localPlayerId,
            this.getMouseState.bind(this),
            this.soundManager
        );

        // Input handler system
        this.inputHandler = new InputHandler(
            this.gameArea,
            this.keys,
            this.camera,
            this.players,
            this.localPlayerId,
            this.currentLobbyId,
            this.socket,
            this.weaponSystem.switchWeapon.bind(this.weaponSystem),
            this.weaponSystem.reloadWeapon.bind(this.weaponSystem),
            this.abilitySystem.useAbility.bind(this.abilitySystem),
            this.weaponSystem.startShooting.bind(this.weaponSystem),
            this.weaponSystem.stopShooting.bind(this.weaponSystem),
            WEAPONS
        );

        // Game status manager
        this.gameStatusManager = new GameStatusManager(
            this.players,
            this.localPlayerId,
            this.gameMode
        );

        // Game state manager
        this.gameStateManager = new GameStateManager(
            this.isRunning,
            this.isPaused,
            this.gameStatusManager.updateGameStatus.bind(this.gameStatusManager),
            this.soundManager,
            this.showGameEndScreen.bind(this),
            this.showWinnerScreen.bind(this),
            this.showLobbyScreen.bind(this)
        );

        // Player lifecycle manager
        this.playerLifecycleManager = new PlayerLifecycleManager(
            this.players,
            this.localPlayerId,
            this.worldWidth,
            this.worldHeight,
            this.gameStatusManager.updateLivesCounter.bind(this.gameStatusManager),
            this.gameStatusManager.showGameStatusBanner.bind(this.gameStatusManager),
            this.showWinnerScreen.bind(this)
        );

        // Network manager
        this.networkManager = new NetworkManager(
            this.socket,
            this.players,
            this.localPlayerId,
            this.zombies,
            this.projectiles,
            this.effects,
            this.abilityCooldowns,
            null, // updateLobbyInfo handled directly in NetworkManager
            this.addEffect.bind(this),
            this.projectileManager,
            this.effectManager,
            this.gameStatusManager,
            this.gameStateManager,
            this.playerLifecycleManager,
            this.soundManager,
            this.updateScoreboard.bind(this),
            this.addProjectile.bind(this),
            WEAPONS
        );

        // Game loop manager
        this.gameLoop = new GameLoop(this);

        // Initialize
        this.init();
    }

    init() {
        this.inputHandler.setupEventListeners();
        this.networkManager.setupSocketListeners();
        this.gameLoop.startGameLoop();

        // Initialize walls and set up responsive game area
        if (this.gameArea) {
            this.gameArea.style.width = `${this.worldWidth}px`;
            this.gameArea.style.height = `${this.worldHeight}px`;
            this.gameArea.style.position = "absolute";
            this.gameArea.style.transformOrigin = "top left";
            const parent = this.gameArea.parentElement;
            if (parent) {
                parent.style.position = parent.style.position || "relative";
                parent.style.width = "100vw";
                parent.style.height = "100vh";
                parent.style.overflow = "hidden";
            }
            this.camera.updateScale();
            window.addEventListener("resize", () => this.camera.updateScale());
        }
        this.buildDefaultWalls();
    }

    buildDefaultWalls() {
        const W = this.worldWidth;
        const H = this.worldHeight;
        const wallThickness = Math.max(16, Math.floor(Math.min(W, H) * 0.015));

        // Keep only 3 interior cover walls, no perimeter blockers
        this.walls = [
            // Horizontal cover near top-left quadrant
            { x: W * 0.18, y: H * 0.22, w: W * 0.24, h: wallThickness },
            // Vertical cover around center-right (not in exact center)
            { x: W * 0.62, y: H * 0.38, w: wallThickness, h: H * 0.26 },
            // Horizontal cover near bottom-left quadrant
            { x: W * 0.25, y: H * 0.72, w: W * 0.3, h: wallThickness },
        ];
    }








    render() {
        this.renderer.clear();
        const cameraPos = this.camera.getCamera();

        // Render game objects in order (back to front)
        this.renderer.renderWalls(this.walls, cameraPos);
        if (this.zombies && this.zombies.size) {
            this.renderer.renderZombies(this.zombies, cameraPos);
        }
        this.renderer.renderPlayers(this.players, this.localPlayerId, cameraPos);
        this.renderer.renderProjectiles(this.projectiles, cameraPos);
        this.renderer.renderEffects(this.effects, cameraPos);
        this.renderer.renderUI(this);
    }

    // Public API methods for player management
    addPlayer(id, name, x, y) {
        this.playerManager.addPlayer(id, name, x, y);
    }

    removePlayer(id) {
        this.playerManager.removePlayer(id);
    }

    // Update PlayerManager references when GameEngine properties change
    updatePlayerManagerReferences() {
        this.playerManager.updateReferences(this.players, this.localPlayerId, this.keys, this.camera);
    }

    // Update ProjectileManager references when GameEngine properties change
    updateProjectileManagerReferences() {
        this.projectileManager.updateReferences(this.projectiles, this.walls, this.physics, this.effectManager.addEffect.bind(this.effectManager), this.zombies);
    }

    // Public API methods for projectile management
    addProjectile(projectileData) {
        this.projectileManager.addProjectile(projectileData);
    }

    // Update EffectManager references when GameEngine properties change
    updateEffectManagerReferences() {
        this.effectManager.updateReferences(this.effects);
    }

    // Public API methods for effect management
    addEffect(effectData) {
        this.effectManager.addEffect(effectData);

        // Play sounds based on effect type (only if not paused)
        if (effectData.type === "slow") {
            // Mage ability sound
            this.soundManager.playAbilitySound("mage", this.isPaused);
        } else if (effectData.type === "heal") {
            // Healer ability sound
            this.soundManager.playAbilitySound("healer", this.isPaused);
        } else if (effectData.type === "explosion") {
            // Melee slam ability sound
            this.soundManager.playAbilitySound("melee", this.isPaused);
        } else if (effectData.type === "meleeAttack") {
            // Melee attack ability sound
            this.soundManager.playAbilitySound("melee", this.isPaused);
        }
    }

    // Update InputHandler references when GameEngine properties change
    updateInputHandlerReferences() {
        this.inputHandler.updateReferences(
            this.gameArea,
            this.keys,
            this.camera,
            this.players,
            this.localPlayerId,
            this.currentLobbyId,
            this.socket,
            this.weaponSystem.switchWeapon.bind(this.weaponSystem),
            this.weaponSystem.reloadWeapon.bind(this.weaponSystem),
            this.abilitySystem.useAbility.bind(this.abilitySystem),
            this.weaponSystem.startShooting.bind(this.weaponSystem),
            this.weaponSystem.stopShooting.bind(this.weaponSystem),
            WEAPONS
        );
    }

    // Get mouse state from InputHandler
    getMouseState() {
        return this.inputHandler.getMouseState();
    }

    // Update WeaponSystem references when GameEngine properties change
    updateWeaponSystemReferences() {
        this.weaponSystem.updateReferences(
            this.players,
            this.localPlayerId,
            this.isRunning,
            this.isPaused,
            this.getMouseState.bind(this),
            this.projectileManager,
            this.effectManager,
            this.socket,
            this.soundManager
        );
    }

    // Public API methods for weapon system
    startShooting() {
        this.weaponSystem.startShooting();
    }

    stopShooting() {
        this.weaponSystem.stopShooting();
    }

    shoot() {
        this.weaponSystem.shoot();
    }

    switchWeapon(weaponName) {
        this.weaponSystem.switchWeapon(weaponName);
    }

    reloadWeapon() {
        this.weaponSystem.reloadWeapon();
    }

    // Update AbilitySystem references when GameEngine properties change
    updateAbilitySystemReferences() {
        this.abilitySystem.updateReferences(
            this.players,
            this.localPlayerId,
            this.getMouseState.bind(this),
            this.soundManager
        );
    }

    // Public API methods for ability system
    useAbility(abilityName) {
        this.abilitySystem.useAbility(abilityName);
    }

    // Update GameStateManager references when GameEngine properties change
    updateGameStateManagerReferences() {
        this.gameStateManager.updateReferences(
            this.isRunning,
            this.isPaused,
            this.updateGameStatus.bind(this),
            this.soundManager,
            this.showGameEndScreen.bind(this),
            this.showWinnerScreen.bind(this),
            this.showLobbyScreen.bind(this)
        );
    }

    // Public API methods for game state management
    pauseGame(pausedBy) {
        this.gameStateManager.pauseGame(pausedBy);
    }

    resumeGame(resumedBy) {
        this.gameStateManager.resumeGame(resumedBy);
    }

    quitGame(quitBy) {
        this.gameStateManager.quitGame(quitBy);
    }

    endGame(winner) {
        this.gameStateManager.endGame(winner);
    }

    // Update GameStatusManager references when GameEngine properties change
    updateGameStatusManagerReferences() {
        this.gameStatusManager.updateReferences(
            this.players,
            this.localPlayerId,
            this.gameMode
        );
    }

    // Public API methods for game status management
    updateGameStatus(status) {
        this.gameStatusManager.updateGameStatus(status);
    }

    updateWaveCounter(wave) {
        this.gameStatusManager.updateWaveCounter(wave);
    }

    updateLivesCounter() {
        this.gameStatusManager.updateLivesCounter();
    }

    showGameStatusBanner(message, type = "info") {
        this.gameStatusManager.showGameStatusBanner(message, type);
    }

    updateScoreboard() {
        this.gameStatusManager.updateScoreboard();
    }

    // Update PlayerLifecycleManager references when GameEngine properties change
    updatePlayerLifecycleManagerReferences() {
        this.playerLifecycleManager.updateReferences(
            this.players,
            this.localPlayerId,
            this.worldWidth,
            this.worldHeight,
            this.gameStatusManager.updateLivesCounter.bind(this.gameStatusManager),
            this.gameStatusManager.showGameStatusBanner.bind(this.gameStatusManager),
            this.showWinnerScreen.bind(this)
        );
    }

    // Public API methods for player lifecycle management
    handleLocalPlayerDeath() {
        this.playerLifecycleManager.handleLocalPlayerDeath();
    }

    handleLocalPlayerRespawn() {
        this.playerLifecycleManager.handleLocalPlayerRespawn();
    }

    disablePlayerInput() {
        this.playerLifecycleManager.disablePlayerInput();
    }

    // Update NetworkManager references when GameEngine properties change
    updateNetworkManagerReferences() {
        this.networkManager.updateReferences(
            this.socket,
            this.players,
            this.localPlayerId,
            this.zombies,
            this.projectiles,
            this.effects,
            this.abilityCooldowns,
            null, // updateLobbyInfo handled directly in NetworkManager
            this.addEffect.bind(this),
            this.projectileManager,
            this.effectManager,
            this.gameStatusManager,
            this.gameStateManager,
            this.playerLifecycleManager,
            this.soundManager,
            this.updateScoreboard.bind(this),
            this.addProjectile.bind(this),
            WEAPONS
        );
    }

    // Public API methods for network management
    setupSocketListeners() {
        this.networkManager.setupSocketListeners();
    }

    // Public API methods for game loop management
    startGameLoop() {
        this.gameLoop.startGameLoop();
    }

    update(deltaTime) {
        this.gameLoop.update(deltaTime);
    }

    updateFPS(currentTime) {
        this.gameLoop.updateFPS(currentTime);
    }















    showGameEndScreen(winner = null, quitInfo = null) {
        const gameEndOverlay = document.getElementById("gameEndOverlay");
        const winnerInfo = document.getElementById("winnerInfo");
        const finalScoresList = document.getElementById("finalScoresList");

        if (gameEndOverlay && winnerInfo && finalScoresList) {
            if (quitInfo) {
                winnerInfo.innerHTML = `
                    <h4>🚪 Game Quit</h4>
                    <p>${quitInfo.quitBy} quit the game</p>
                `;
            } else if (winner) {
                winnerInfo.innerHTML = `
                    <h4>🏆 Winner!</h4>
                    <p>${winner.name} wins with ${winner.score} points!</p>
                `;
            } else {
                winnerInfo.innerHTML = `
                    <h4>🎮 Game Over</h4>
                    <p>The game has ended</p>
                `;
            }

            // Populate final scores
            const players = Array.from(this.players.values());
            players.sort((a, b) => b.score - a.score);

            finalScoresList.innerHTML = players
                .map(
                    (player) => `
                <div class="final-score-item">
                    <span>${player.name}</span>
                    <span>${player.score} pts (${player.kills} kills, ${player.deaths} deaths)</span>
                </div>
            `
                )
                .join("");

            gameEndOverlay.classList.remove("hidden");
        }
    }

    showWinnerScreen(winner) {
        const gameEndOverlay = document.getElementById("gameEndOverlay");
        const winnerInfo = document.getElementById("winnerInfo");
        const finalScoresList = document.getElementById("finalScoresList");

        if (gameEndOverlay && winnerInfo && finalScoresList) {
            winnerInfo.innerHTML = `
                <h4>🏆 MVP!</h4>
                <p>${winner.name} is the MVP with ${winner.score} points!</p>
            `;

            const players = Array.from(this.players.values());
            players.sort((a, b) => b.score - a.score);

            finalScoresList.innerHTML = players
                .map(
                    (player) => `
                <div class="final-score-item">
                    <span>${player.name}</span>
                    <span>${player.score} pts (${player.kills} kills, ${player.deaths} deaths)</span>
                </div>
            `
                )
                .join("");

            gameEndOverlay.classList.remove("hidden");
        }
    }

    showLobbyScreen() {
        // Hide game area and show lobby
        const gameArea = document.getElementById("gameArea");
        const lobbyPage = document.getElementById("lobbyPage");

        if (gameArea) {
            gameArea.style.display = "none";
        }
        if (lobbyPage) {
            lobbyPage.classList.remove("hidden");
        }
    }

    setLocalPlayerId(id) {
        this.localPlayerId = id;

        // Update all system references with the new local player ID
        this.updatePlayerManagerReferences();
        this.updateInputHandlerReferences();
        this.updateWeaponSystemReferences();
        this.updateAbilitySystemReferences();
        this.updateGameStatusManagerReferences();
        this.updatePlayerLifecycleManagerReferences();
        this.updateNetworkManagerReferences();

        this.isRunning = true;
    }

    getGameTime() {
        if (!this.gameStartTime) {
            return 0;
        }
        const elapsed = Date.now() - this.gameStartTime;
        return elapsed;
    }

    getGameTimeRemaining() {
        const remaining = Math.max(0, this.gameDuration - this.getGameTime());
        return remaining;

    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    stopGameLoop() {
        this.isRunning = false;
        this.isPaused = false;

        // Stop the game loop
        if (this.gameLoop && this.gameLoop.stop) {
            this.gameLoop.stop();
        }

        // Stop all sounds and soundtrack
        if (this.soundManager) {
            this.soundManager.cleanup();
        }

        // Clear all game state
        this.players.clear();
        this.projectiles.clear();
        this.effects.clear();
        this.zombies.clear();

        // Clear renderer
        if (this.renderer) {
            this.renderer.clear();
        }

    }

    // restartGame is now handled by main.js to avoid conflicts
}

// Make GameEngine available globally
// @ts-ignore
window.GameEngine = GameEngine;