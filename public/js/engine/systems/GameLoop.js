// Game Loop & Update System
class GameLoop {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.isRunning = false;
        this.animationId = null;
    }

    startGameLoop() {
        this.isRunning = true;
        const gameLoop = (currentTime) => {
            // Check if we should stop
            if (!this.isRunning) {
                return;
            }

            // Continue the loop
            this.animationId = requestAnimationFrame(gameLoop);

            // Calculate delta time
            if (this.gameEngine.lastTime === 0) {
                this.gameEngine.lastTime = currentTime;
                return; // Skip first frame to get proper delta time
            }

            const rawDelta = (currentTime - this.gameEngine.lastTime) / 1000;
            this.gameEngine.deltaTime = Math.min(rawDelta, 0.016); // Cap at 60 FPS max to prevent large jumps
            this.gameEngine.lastTime = currentTime;

            // Update FPS counter
            this.updateFPS(currentTime);

            // Only update and render if game is running
            if (this.gameEngine.isRunning && !this.gameEngine.isPaused) {
                // update camera first for correct world/screen mapping
                const localPlayer = this.gameEngine.players.get(this.gameEngine.localPlayerId);
                this.gameEngine.camera.updateCamera(localPlayer);
                this.update(this.gameEngine.deltaTime);
                this.gameEngine.render();

                // Update scoreboard periodically (every 60 frames / ~1 second)
                if (!this.gameEngine.scoreboardUpdateCounter) this.gameEngine.scoreboardUpdateCounter = 0;
                this.gameEngine.scoreboardUpdateCounter++;
                if (this.gameEngine.scoreboardUpdateCounter >= 60) {
                    this.gameEngine.gameStatusManager.updateScoreboard();
                    this.gameEngine.scoreboardUpdateCounter = 0;
                }
            }
        };

        this.animationId = requestAnimationFrame(gameLoop);
    }

    stop() {
        console.log("Stopping game loop...");
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    update(deltaTime) {
        // Update local player
        const localPlayer = this.gameEngine.players.get(this.gameEngine.localPlayerId);
        if (localPlayer) {
            localPlayer.update(deltaTime, this.gameEngine.walls);

            // Check for local player death (health reached 0)
            // Only handle locally if server hasn't already sent death event
            if (localPlayer.health <= 0 && !localPlayer.isDead) {
                // This is a fallback - the server should handle death authoritatively
                // But we can provide immediate visual feedback
                localPlayer.isDead = true;
                this.gameEngine.gameStatusManager.updateLivesCounter();
            }

            // Send position update to server
            this.gameEngine.socket.emit("playerMove", {
                x: localPlayer.x,
                y: localPlayer.y,
            });
        }

        // Update projectiles
        this.gameEngine.projectileManager.updateProjectiles(deltaTime);

        // Update effects
        this.gameEngine.effectManager.updateEffects(deltaTime);

        // Smoothly lerp NPC display position for player-like motion
        if (this.gameEngine.npc && typeof this.gameEngine.npc.displayX === "number") {
            const alpha = Math.max(0.0, Math.min(1.0, deltaTime * 12));
            this.gameEngine.npc.displayX =
                this.gameEngine.npc.displayX + (this.gameEngine.npc.x - this.gameEngine.npc.displayX) * alpha;
            this.gameEngine.npc.displayY =
                this.gameEngine.npc.displayY + (this.gameEngine.npc.y - this.gameEngine.npc.displayY) * alpha;
        }

        // Update camera
        this.gameEngine.camera.updateCamera(localPlayer);
    }

    updateFPS(currentTime) {
        this.gameEngine.frameCount++;

        if (currentTime - this.gameEngine.lastFpsUpdate >= 1000) {
            this.gameEngine.fps = this.gameEngine.frameCount;
            this.gameEngine.frameCount = 0;
            this.gameEngine.lastFpsUpdate = currentTime;

            // Performance monitoring and adaptive quality
            this.adaptPerformance();
        }
    }

    adaptPerformance() {
        const fps = this.gameEngine.fps;

        // If FPS drops below 45, reduce quality
        if (fps < 45 && !this.gameEngine.performanceMode) {
            this.gameEngine.performanceMode = true;
            console.log("Performance mode enabled - reducing quality");

            // Reduce zombie interpolation frequency
            if (this.gameEngine.renderer && this.gameEngine.renderer.zombieRenderer) {
                this.gameEngine.renderer.zombieRenderer.performanceMode = true;
            }

            // Reduce projectile rendering quality
            if (this.gameEngine.renderer && this.gameEngine.renderer.projectileRenderer) {
                this.gameEngine.renderer.projectileRenderer.setPerformanceMode(true);
            }
        }
        // If FPS is above 55, restore quality
        else if (fps > 55 && this.gameEngine.performanceMode) {
            this.gameEngine.performanceMode = false;
            console.log("Performance mode disabled - restoring quality");

            if (this.gameEngine.renderer && this.gameEngine.renderer.zombieRenderer) {
                this.gameEngine.renderer.zombieRenderer.performanceMode = false;
            }

            // Restore projectile rendering quality
            if (this.gameEngine.renderer && this.gameEngine.renderer.projectileRenderer) {
                this.gameEngine.renderer.projectileRenderer.setPerformanceMode(false);
            }
        }
    }

}

// Make GameLoop available globally
// @ts-ignore
window.GameLoop = GameLoop;