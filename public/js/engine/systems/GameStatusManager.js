// Game Status & UI Updates Manager
class GameStatusManager {
    constructor(players, localPlayerId, gameMode) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.gameMode = gameMode;
    }

    updateGameStatus(status) {
        const gameStatusElement = document.getElementById("gameStatus");
        if (gameStatusElement) {
            gameStatusElement.textContent = status;
        }
    }

    updateWaveCounter(wave) {
        const waveCounterElement = document.getElementById("waveCounter");
        if (waveCounterElement) {
            waveCounterElement.textContent = `Wave: ${wave}`;
        }
    }

    updateLivesCounter() {
        const livesCounterElement = document.getElementById("livesCounter");
        const localPlayer = this.players.get(this.localPlayerId);
        if (livesCounterElement && localPlayer) {
            const lives = localPlayer.lives || 0;
            console.log(
                `Client: Updating lives counter to ${lives} for player ${this.localPlayerId}`
            ); // Debug log
            livesCounterElement.textContent = `❤️ ${lives}`;

            // Change color based on lives remaining
            if (lives <= 1) {
                livesCounterElement.style.color = "#ff4757"; // Red for critical
            } else if (lives <= 2) {
                livesCounterElement.style.color = "#ffa502"; // Orange for warning
            } else {
                livesCounterElement.style.color = "#2ed573"; // Green for safe
            }
        }
    }

    showGameStatusBanner(message, type = "info") {
        console.log("showGameStatusBanner called:", message, type); // Debug log

        // Remove existing banner if present
        let existingBanner = document.getElementById("gameStatusBanner");
        if (existingBanner) {
            existingBanner.remove();
        }

        // Create new banner
        const banner = document.createElement("div");
        banner.id = "gameStatusBanner";

        // Set colors based on type
        let bgColor, textColor, borderColor;
        switch (type) {
            case "success":
                bgColor = "rgba(46, 213, 115, 0.9)";
                textColor = "#ffffff";
                borderColor = "#2ed573";
                break;
            case "warning":
                bgColor = "rgba(255, 165, 2, 0.9)";
                textColor = "#ffffff";
                borderColor = "#ffa502";
                break;
            case "error":
                bgColor = "rgba(255, 71, 87, 0.9)";
                textColor = "#ffffff";
                borderColor = "#ff4757";
                break;
            default:
                bgColor = "rgba(52, 152, 219, 0.9)";
                textColor = "#ffffff";
                borderColor = "#3498db";
        }

        banner.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${bgColor};
      color: ${textColor};
      padding: 12px 24px;
      border-radius: 8px;
      border: 2px solid ${borderColor};
      font-size: 1.1rem;
      font-weight: bold;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 80%;
      word-wrap: break-word;
    `;

        banner.textContent = message;
        document.body.appendChild(banner);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (banner && banner.parentNode) {
                banner.remove();
            }
        }, 5000);
    }

    updateScoreboard() {
            const scoreboardContent = document.getElementById("scoreboardContent");
            if (!scoreboardContent) return;

            const players = Array.from(this.players.values());
            players.sort((a, b) => (b.score || 0) - (a.score || 0));


            // Ensure all players have proper names
            players.forEach((player) => {
                if (!player.name) {
                    console.warn(`Player ${player.id} missing name, using fallback`);
                    player.name = `Player ${player.id?.substring(0, 4) || "Unknown"}`;
                }
            });

            if (players.length === 0) {
                scoreboardContent.innerHTML = `<h4>Scoreboard</h4><p>No players found</p>`;
                return;
            }


            // Different scoreboard layout for different game modes
            let scoreboardHTML;
            if (this.gameMode === "deathmatch") {
                scoreboardHTML = `
                <h4>Deathmatch Scoreboard</h4>
                ${players
                  .map(
                    (player) => `
                        <div class="score-item ${
                          player.isDead ? "dead-player" : ""
                        }">
                            <span class="player-name">${
                              player.name || "Unknown"
                            }</span>
                            <span class="player-kills">💀 ${player.kills || 0}</span>
                            <span class="player-deaths">💔 ${player.deaths || 0}</span>
                            <span class="player-score">${player.score || 0}</span>
                        </div>
                    `
                  )
                  .join("")}
            `;
        } else {
            // Survival mode - show lives
            scoreboardHTML = `
                <h4>Survival Scoreboard</h4>
                ${players
                  .map(
                    (player) => `
                        <div class="score-item ${
                          player.isDead ? "dead-player" : ""
                        }">
                            <span class="player-name">${
                              player.name || "Unknown"
                            }</span>
                            <span class="player-lives">❤️ ${
                              player.lives || 0
                            }</span>
                            <span class="player-score">${player.score || 0}</span>
                        </div>
                    `
                  )
                  .join("")}
            `;
        }

        scoreboardContent.innerHTML = scoreboardHTML;

    }

    // Update references when GameEngine properties change
    updateReferences(players, localPlayerId, gameMode) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.gameMode = gameMode;
    }
}

// Make GameStatusManager available globally
// @ts-ignore
window.GameStatusManager = GameStatusManager;