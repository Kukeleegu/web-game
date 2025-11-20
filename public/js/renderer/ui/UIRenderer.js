// UI Renderer - Handles all UI rendering
class UIRenderer {
    constructor(gameArea, gameObjects) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
        this.gameEngine = null; // Will be set by GameRenderer
    }

    setGameEngine(gameEngine) {
        this.gameEngine = gameEngine;
    }

    renderUI(gameEngine) {
            // Cache DOM elements to avoid repeated queries
            if (!this.cachedElements) {
                this.cachedElements = {
                    timerElement: document.getElementById("gameTimer"),
                    fpsElement: document.getElementById("fpsCounter"),
                    lastTimerUpdate: 0,
                    lastFpsUpdate: 0
                };
            }

            const now = performance.now();

            // Update game timer - only every 100ms to reduce DOM updates
            if (this.cachedElements.timerElement && now - this.cachedElements.lastTimerUpdate > 100) {
                const remainingTime = gameEngine.getGameTimeRemaining();
                const elapsedTime = gameEngine.getGameTime();
                const formattedTime = gameEngine.formatTime(remainingTime);

                // Fallback: if countdown shows 5:00 (full time), show elapsed time instead
                if (remainingTime >= gameEngine.gameDuration - 1000) { // Within 1 second of full time
                    this.cachedElements.timerElement.textContent = gameEngine.formatTime(elapsedTime);
                    this.cachedElements.timerElement.title = "Elapsed time (countdown not working)";
                } else {
                    this.cachedElements.timerElement.textContent = formattedTime;
                    this.cachedElements.timerElement.title = "Time remaining";
                }

                // Add visual feedback when time is running low (last 30 seconds)
                if (remainingTime <= 30000) { // 30 seconds
                    this.cachedElements.timerElement.style.color = "#ff4757"; // Red color
                    this.cachedElements.timerElement.style.fontWeight = "bold";
                } else {
                    this.cachedElements.timerElement.style.color = "#ffffff"; // White color
                    this.cachedElements.timerElement.style.fontWeight = "normal";
                }
                this.cachedElements.lastTimerUpdate = now;
            }

            // Update FPS counter - only every 200ms
            if (this.cachedElements.fpsElement && now - this.cachedElements.lastFpsUpdate > 200) {
                this.cachedElements.fpsElement.textContent = `FPS: ${gameEngine.fps}`;
                this.cachedElements.lastFpsUpdate = now;
            }

            // Ability HUD (right-click class ability cooldown)
            // Ensure container exists
            let abilityHud = document.getElementById("abilityHud");
            if (!abilityHud) {
                abilityHud = document.createElement("div");
                abilityHud.id = "abilityHud";
                abilityHud.style.position = "absolute";
                abilityHud.style.left = "10px";
                abilityHud.style.bottom = "10px";
                abilityHud.style.padding = "8px 10px";
                abilityHud.style.background = "rgba(0,0,0,0.4)";
                abilityHud.style.color = "#fff";
                abilityHud.style.borderRadius = "6px";
                abilityHud.style.fontFamily = "sans-serif";
                abilityHud.style.fontSize = "14px";
                this.gameArea.appendChild(abilityHud);
            }

            const me = this.gameEngine && this.gameEngine.players.get(this.gameEngine.localPlayerId);
            let rcName = "Right-Click";
            let abilityIcon = "🔧";
            if (me && me.className) {
                switch (me.className) {
                    case "healer":
                        rcName = "Divine Heal";
                        abilityIcon = "✨";
                        break;
                    case "mage":
                        rcName = "Mystic Slow";
                        abilityIcon = "🌀";
                        break;
                    case "ranged":
                        rcName = "Piercing Shot";
                        abilityIcon = "🏹";
                        break;
                    case "melee":
                        rcName = "Ground Slam";
                        abilityIcon = "💥";
                        break;
                    default:
                        rcName = "Right-Click";
                        abilityIcon = "🔧";
                }
            }
            // Determine remaining cooldown
            let remainingMs = 0;
            if (gameEngine.abilityCooldowns) {
                const typesByClass = {
                    healer: "healer_heal",
                    mage: "mage_slow",
                    ranged: "penetrating_arrow",
                    melee: "melee_slam",
                };
                const t = me && me.className ? typesByClass[me.className] : null;
                if (t && gameEngine.abilityCooldowns.has(t)) {
                    const availableAt = gameEngine.abilityCooldowns.get(t);
                    remainingMs = Math.max(0, availableAt - Date.now());
                }
            }
            const remainingSec = Math.ceil(remainingMs / 1000);
            const isReady = remainingMs <= 0;

            // Enhanced visual styling
            abilityHud.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: ${
        isReady ? "rgba(46, 213, 115, 0.9)" : "rgba(255, 71, 87, 0.9)"
      }; border-radius: 8px; border: 2px solid ${
      isReady ? "#2ed573" : "#ff4757"
    }; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        <span style="font-size: 18px;">${abilityIcon}</span>
        <div style="display: flex; flex-direction: column; align-items: flex-start;">
          <span style="font-weight: bold; font-size: 12px; color: white;">${rcName}</span>
          <span style="font-size: 10px; color: ${
            isReady ? "#ffffff" : "#ffcccc"
          };">${isReady ? "READY" : `${remainingSec}s`}</span>
        </div>
      </div>
    `;
    }
}

// Make UIRenderer available globally
// @ts-ignore
window.UIRenderer = UIRenderer;