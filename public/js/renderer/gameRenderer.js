// Game Renderer

class GameRenderer {
    constructor(gameArea) {
        this.gameArea = gameArea;
        console.log("GameRenderer constructor - gameArea:", gameArea);
        this.gameObjects = new Map(); // Track DOM elements for game objects
        this.cleanupInterval = null;
        this.gameEngine = null; // Will be set by GameEngine

        // Initialize wall renderer
        this.wallRenderer = new WallRenderer(gameArea, this.gameObjects);

        // Initialize NPC renderer
        this.npcRenderer = new NPCRenderer(gameArea, this.gameObjects);

        // Initialize zombie renderer
        this.zombieRenderer = new ZombieRenderer(gameArea, this.gameObjects);

        // Initialize projectile trail renderer
        this.projectileTrailRenderer = new ProjectileTrailRenderer(gameArea, this.gameObjects);

        // Initialize projectile renderer
        this.projectileRenderer = new ProjectileRenderer(gameArea, this.gameObjects, this.projectileTrailRenderer);

        // Initialize player renderer
        this.playerRenderer = new PlayerRenderer(gameArea, this.gameObjects);

        // Initialize effect renderer
        console.log('GameRenderer: Checking if EffectRenderer is defined:', typeof EffectRenderer);
        if (typeof EffectRenderer !== 'undefined') {
            console.log('GameRenderer: EffectRenderer is defined, creating instance');
            this.effectRenderer = new EffectRenderer(gameArea, this.gameObjects);
        } else {
            console.error('EffectRenderer is not defined. Check script loading order.');
            // Create a dummy effect renderer to prevent crashes
            this.effectRenderer = {
                renderEffects: () => { console.log('Dummy effect renderer called - no effects will be rendered'); },
                setGameEngine: () => {}
            };
        }

        // Initialize UI renderer
        this.uiRenderer = new UIRenderer(gameArea, this.gameObjects);

        this.init();
    }

    init() {
        // Set up cleanup interval to remove unused DOM elements
        this.cleanupInterval = setInterval(() => {
            this.cleanupUnusedElements();
        }, 5000); // Clean up every 5 seconds
    }

    set gameEngine(gameEngine) {
        this._gameEngine = gameEngine;
        if (this.effectRenderer) {
            this.effectRenderer.setGameEngine(gameEngine);
        }
        if (this.uiRenderer) {
            this.uiRenderer.setGameEngine(gameEngine);
        }
    }

    get gameEngine() {
        return this._gameEngine;
    }

    // Method to set gameEngine after initialization is complete
    setGameEngine(gameEngine) {
        console.log("GameRenderer: setGameEngine called with:", gameEngine);
        this._gameEngine = gameEngine;
        if (this.effectRenderer) {
            console.log("GameRenderer: Calling effectRenderer.setGameEngine");
            this.effectRenderer.setGameEngine(gameEngine);
        }
        if (this.uiRenderer) {
            this.uiRenderer.setGameEngine(gameEngine);
        }
    }

    clear() {
        // Remove all game object DOM elements
        this.gameObjects.forEach((element) => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.gameObjects.clear();
    }

    renderWalls(walls, camera) {
        this.wallRenderer.renderWalls(walls, camera);
    }

    renderNPC(npc, camera) {
        this.npcRenderer.renderNPC(npc, camera);
    }

    renderZombies(zombies, camera) {
        this.zombieRenderer.renderZombies(zombies, camera);
    }

    renderPlayers(players, localPlayerId, camera) {
        this.playerRenderer.renderPlayers(players, localPlayerId, camera);
    }

    renderProjectiles(projectiles, camera) {
        this.projectileRenderer.renderProjectiles(projectiles, camera);
    }

    renderProjectileTrail(projectile, camera, projectileId) {
        this.projectileTrailRenderer.renderProjectileTrail(projectile, camera, projectileId);
    }

    renderEffects(effects, camera) {
        this.effectRenderer.renderEffects(effects, camera);
    }

    renderUI(gameEngine) {
        this.uiRenderer.renderUI(gameEngine);
    }

    cleanupUnusedElements() {
        // Remove DOM elements that are no longer needed
        const keysToRemove = [];
        this.gameObjects.forEach((element, key) => {
            if (!element || !element.parentNode) {
                keysToRemove.push(key);
            }
        });

        keysToRemove.forEach((key) => {
            this.gameObjects.delete(key);
        });
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

// Make GameRenderer available globally
// @ts-ignore
window.GameRenderer = GameRenderer;