// Player Renderer - Handles player rendering
class PlayerRenderer {
    constructor(gameArea, gameObjects) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
    }

    renderPlayers(players, localPlayerId, camera) {
        players.forEach((player, id) => {
            const isLocalPlayer = id === localPlayerId;
            const screenX = player.x - camera.x;
            const screenY = player.y - camera.y;

            // debug disabled

            let playerElement = this.gameObjects.get(`player-${id}`);

            if (!playerElement) {
                // Create new player element
                playerElement = document.createElement("div");
                playerElement.className = "game-player";
                playerElement.id = `player-${id}`;

                // Create player visual elements
                const playerCircle = document.createElement("div");
                playerCircle.className = "player-circle";
                playerElement.appendChild(playerCircle);

                const playerName = document.createElement("div");
                playerName.className = "player-name";
                playerElement.appendChild(playerName);

                const healthBar = document.createElement("div");
                healthBar.className = "player-health-bar";
                const healthFill = document.createElement("div");
                healthFill.className = "player-health-fill";
                healthBar.appendChild(healthFill);
                playerElement.appendChild(healthBar);

                const weaponIndicator = document.createElement("div");
                weaponIndicator.className = "player-weapon";
                playerElement.appendChild(weaponIndicator);

                this.gameArea.appendChild(playerElement);
                this.gameObjects.set(`player-${id}`, playerElement);
            }

            // Update position
            playerElement.style.left = `${screenX}px`;
            playerElement.style.top = `${screenY}px`;
            playerElement.style.transform = `translate(-50%, -50%)`;

            // Remove debug visuals
            playerElement.style.border = "";
            playerElement.style.backgroundColor = "";

            // Update visual properties
            const playerCircle = playerElement.querySelector(".player-circle");
            if (playerCircle) {
                playerCircle.style.width = `${player.size}px`;
                playerCircle.style.height = `${player.size}px`;

                // Handle dead players
                if (player.isDead) {
                    playerCircle.style.backgroundColor = "#666666"; // Gray for dead
                    playerCircle.style.opacity = "0.3";
                    playerElement.style.display = "none"; // Hide dead players
                } else {
                    playerElement.style.display = "block";
                    playerCircle.style.opacity = "1";

                    // Handle invulnerability
                    if (player.isInvulnerable) {
                        // Flashing effect for invulnerable players
                        const flashTime = Date.now() % 500;
                        playerCircle.style.opacity = flashTime < 250 ? "0.5" : "1";
                        playerCircle.style.backgroundColor = "#00ffff"; // Cyan for invulnerable
                        playerCircle.style.borderColor = "#ffffff";
                    } else {
                        playerCircle.style.backgroundColor = player.color;
                        playerCircle.style.borderColor = isLocalPlayer ?
                            "#28a745" :
                            "#dc3545";
                    }
                }
            }

            // Update name
            const playerName = playerElement.querySelector(".player-name");
            if (playerName) {
                if (player.isDead) {
                    playerName.style.display = "none"; // Hide nametag for dead players
                } else {
                    playerName.style.display = "block";
                    playerName.textContent = player.name;
                    playerName.style.color = "white";
                }
            }

            // Update health bar
            const healthFill = playerElement.querySelector(".player-health-fill");
            if (healthFill) {
                const healthPercent = (player.health / player.maxHealth) * 100;
                healthFill.style.width = `${healthPercent}%`;
                healthFill.style.backgroundColor =
                    healthPercent > 50 ?
                    "#2ed573" :
                    healthPercent > 25 ?
                    "#ffa502" :
                    "#ff4757";
            }

            // Update weapon indicator
            const weaponIndicator = playerElement.querySelector(".player-weapon");
            if (weaponIndicator && isLocalPlayer) {
                weaponIndicator.textContent = player.currentWeapon;
                weaponIndicator.style.color = "yellow";
            }
        });
    }
}

// Make PlayerRenderer available globally
// @ts-ignore
window.PlayerRenderer = PlayerRenderer;