// Zombie Renderer - Handles zombie rendering
class ZombieRenderer {
    constructor(gameArea, gameObjects) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
        this.performanceMode = false; // Default to normal performance mode
    }

    renderZombies(zombies, camera) {
        // Mark all existing zombie nodes for reuse
        const activeKeys = new Set();
        zombies.forEach((z, id) => {
            activeKeys.add(`z-${id}`);
            let el = this.gameObjects.get(`z-${id}`);
            if (!el) {
                el = document.createElement("div");
                el.className = "game-player";
                el.id = `z-${id}`;
                el.style.pointerEvents = "none";
                // Visuals similar to player
                const circle = document.createElement("div");
                circle.className = "player-circle";
                el.appendChild(circle);
                // No name tag for zombies
                const bar = document.createElement("div");
                bar.className = "player-health-bar";
                const fill = document.createElement("div");
                fill.className = "player-health-fill";
                bar.appendChild(fill);
                el.appendChild(bar);
                this.gameArea.appendChild(el);
                this.gameObjects.set(`z-${id}`, el);
            }

            // Optimized position calculation - only interpolate if needed
            if (!el._lastUpdate) el._lastUpdate = 0;
            const now = performance.now();

            // Adaptive update frequency based on performance mode
            const updateInterval = this.performanceMode ? 33 : 16; // 30 FPS vs 60 FPS
            if (now - el._lastUpdate > updateInterval) {
                if (!el._targetPos) {
                    el._targetPos = { x: z.x, y: z.y };
                    el._currentPos = { x: z.x, y: z.y };
                }

                // Update target position
                el._targetPos.x = z.x;
                el._targetPos.y = z.y;

                // Interpolate to target position for smooth movement
                const lerpFactor = 0.4; // Slightly faster for better responsiveness
                el._currentPos.x += (el._targetPos.x - el._currentPos.x) * lerpFactor;
                el._currentPos.y += (el._targetPos.y - el._currentPos.y) * lerpFactor;
                el._lastUpdate = now;
            }

            const sx = el._currentPos.x - camera.x;
            const sy = el._currentPos.y - camera.y;

            el.style.left = `${sx}px`;
            el.style.top = `${sy}px`;
            el.style.transform = `translate(-50%, -50%)`;

            const circle = el.querySelector(".player-circle");
            if (circle && !circle._initialized) {
                const size = z.size || 36;
                circle.style.width = `${size}px`;
                circle.style.height = `${size}px`;

                // Different colors and styles for different NPC types
                if (z.type === "fastMob") {
                    circle.style.backgroundColor = "#ff6b35"; // Orange for fast mobs
                    circle.style.borderColor = "#ffd700";
                    circle.style.borderWidth = "3px";
                    circle.style.boxShadow = "0 0 15px rgba(255, 107, 53, 0.6)";
                } else if (z.type === "bossMob") {
                    circle.style.backgroundColor = "#8b0000"; // Dark red for boss mobs
                    circle.style.borderColor = "#ff4500";
                    circle.style.borderWidth = "4px";
                    circle.style.boxShadow = "0 0 25px rgba(139, 0, 0, 0.8)";
                } else {
                    // Regular zombie
                    circle.style.backgroundColor = "#3cb371";
                    circle.style.borderColor = "#ffffff";
                    circle.style.borderWidth = "2px";
                }

                circle._initialized = true;
            }

            // Visual indication for slowed zombies and special effects
            if (circle) {
                const isSlowed = z.slowUntil && Date.now() < z.slowUntil;
                if (isSlowed) {
                    // Apply slow effect with different colors for different NPC types
                    if (z.type === "fastMob") {
                        circle.style.backgroundColor = "#4169e1"; // Blue when slowed
                        circle.style.border = "3px solid #00bfff";
                    } else if (z.type === "bossMob") {
                        circle.style.backgroundColor = "#4b0082"; // Dark purple when slowed
                        circle.style.border = "4px solid #9370db";
                    } else {
                        circle.style.backgroundColor = "#4169e1"; // Blue when slowed
                        circle.style.border = "2px solid #00bfff";
                    }
                } else if (circle._wasSlowed) {
                    // Reset color when no longer slowed
                    if (z.type === "fastMob") {
                        circle.style.backgroundColor = "#ff6b35";
                        circle.style.border = "3px solid #ffd700";
                    } else if (z.type === "bossMob") {
                        circle.style.backgroundColor = "#8b0000";
                        circle.style.border = "4px solid #ff4500";
                    } else {
                        circle.style.backgroundColor = "#3cb371";
                        circle.style.border = "2px solid #ffffff";
                    }
                }
                circle._wasSlowed = isSlowed;

                // Add pulsing effect for boss mobs to show they're special
                if (z.type === "bossMob") {
                    const pulseIntensity = 0.1 + 0.05 * Math.sin(Date.now() * 0.005);
                    circle.style.boxShadow = `0 0 ${25 + pulseIntensity * 20}px rgba(139, 0, 0, ${0.8 + pulseIntensity})`;
                }
            }

            const fill = el.querySelector(".player-health-fill");
            if (fill) {
                const maxHp = z.maxHealth || 120;
                const pct = Math.max(0, Math.min(1, (z.health || maxHp) / maxHp));
                const widthPct = `${pct * 100}%`;

                // Only update if health percentage changed significantly
                if (fill._lastWidth !== widthPct) {
                    fill.style.width = widthPct;
                    fill.style.backgroundColor =
                        pct > 0.5 ? "#2ed573" : pct > 0.25 ? "#ffa502" : "#ff4757";
                    fill._lastWidth = widthPct;
                }
            }
        });

        // Cleanup zombie nodes not present
        const toRemove = [];
        this.gameObjects.forEach((el, key) => {
            if (key.startsWith("z-") && !activeKeys.has(key)) {
                toRemove.push(key);
            }
        });
        toRemove.forEach((k) => {
            const el = this.gameObjects.get(k);
            if (el && el.parentNode) el.parentNode.removeChild(el);
            this.gameObjects.delete(k);
        });
    }

    // Method to update performance mode
    setPerformanceMode(performanceMode) {
        this.performanceMode = performanceMode;
    }
}

// Make ZombieRenderer available globally
// @ts-ignore
window.ZombieRenderer = ZombieRenderer;