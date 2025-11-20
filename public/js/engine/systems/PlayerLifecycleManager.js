// Player Lifecycle Management
class PlayerLifecycleManager {
    constructor(players, localPlayerId, worldWidth, worldHeight, updateLivesCounter, showGameStatusBanner, showWinnerScreen) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.updateLivesCounter = updateLivesCounter;
        this.showGameStatusBanner = showGameStatusBanner;
        this.showWinnerScreen = showWinnerScreen;
    }

    handleLocalPlayerDeath() {
        const localPlayer = this.players.get(this.localPlayerId);
        if (!localPlayer) return;

        // Mark player as dead locally for immediate visual feedback
        localPlayer.isDead = true;

        // Update lives counter immediately
        this.updateLivesCounter();

        // Show immediate death message
        this.showGameStatusBanner(
            `You died! Respawning... (${localPlayer.lives} lives remaining)`,
            "warning"
        );

        // Show winner screen with current scores when player dies
        // Create a temporary winner object for display purposes
        const players = Array.from(this.players.values());
        const topPlayer = players.reduce((top, player) =>
            player.score > top.score ? player : top, players[0] || {});

        this.showWinnerScreen(topPlayer);

        // Don't handle respawn locally - let the server handle it
        // The server will send playerRespawn event with proper coordinates
    }

    handleLocalPlayerRespawn() {
        const localPlayer = this.players.get(this.localPlayerId);
        if (!localPlayer) return;

        // Reset player state
        localPlayer.isDead = false;
        localPlayer.health = 100;
        localPlayer.isInvulnerable = true;

        // Move to random spawn location
        localPlayer.x = Math.random() * (this.worldWidth - 100) + 50;
        localPlayer.y = Math.random() * (this.worldHeight - 100) + 50;

        // Reset velocity
        localPlayer.vx = 0;
        localPlayer.vy = 0;

        // Show respawn message
        this.showGameStatusBanner(
            `Respawned! You are invulnerable for 3 seconds.`,
            "success"
        );

        // Remove invulnerability after 3 seconds
        setTimeout(() => {
            if (localPlayer) {
                localPlayer.isInvulnerable = false;
            }
        }, 3000);
    }

    disablePlayerInput() {
        console.log("disablePlayerInput called"); // Debug log

        // Disable all player input permanently
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer) {
            localPlayer.isDead = true;
            localPlayer.health = 0;
        }

        // Show winner screen with current scores when player is permanently disabled
        const players = Array.from(this.players.values());
        const topPlayer = players.reduce((top, player) =>
            player.score > top.score ? player : top, players[0] || {});

        this.showWinnerScreen(topPlayer);
    }

    // Update references when GameEngine properties change
    updateReferences(players, localPlayerId, worldWidth, worldHeight, updateLivesCounter, showGameStatusBanner, showWinnerScreen) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.updateLivesCounter = updateLivesCounter;
        this.showGameStatusBanner = showGameStatusBanner;
        this.showWinnerScreen = showWinnerScreen;
    }
}

// Make PlayerLifecycleManager available globally
// @ts-ignore
window.PlayerLifecycleManager = PlayerLifecycleManager;