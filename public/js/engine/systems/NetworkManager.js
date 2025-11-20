// Network Manager - Handles all socket communication and network events
class NetworkManager {
    constructor(socket, players, localPlayerId, zombies, projectiles, effects, abilityCooldowns,
        updateLobbyInfo, addEffect, projectileManager, effectManager,
        gameStatusManager, gameStateManager, playerLifecycleManager, soundManager,
        updateScoreboard, addProjectile, weapons) {
        this.socket = socket;
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.zombies = zombies;
        this.projectiles = projectiles;
        this.effects = effects;
        this.abilityCooldowns = abilityCooldowns;
        this.updateLobbyInfo = updateLobbyInfo;
        this.addEffect = addEffect;
        this.projectileManager = projectileManager;
        this.effectManager = effectManager;
        this.gameStatusManager = gameStatusManager;
        this.gameStateManager = gameStateManager;
        this.playerLifecycleManager = playerLifecycleManager;
        this.soundManager = soundManager;
        this.updateScoreboard = updateScoreboard;
        this.addProjectile = addProjectile;
        this.weapons = weapons;
    }

    setupSocketListeners() {
        // Game started - handled by main.js, which creates this GameEngine instance
        // Players are initialized when the GameEngine is created

        // Player joined
        this.socket.on("lobbyUpdate", (data) => {
            this.updateLobbyInfoInternal(data);
        });

        // Player moved
        this.socket.on("playerMoved", (data) => {
            const player = this.players.get(data.playerId);
            if (player && player.id !== this.localPlayerId) {
                player.x = data.x;
                player.y = data.y;
            }
        });

        // Player shot (recreate projectile on clients)
        this.socket.on("playerShot", (data) => {
            if (data.playerId !== this.localPlayerId) {
                const shooter = this.players.get(data.playerId);
                if (!shooter) return;
                const weapon = this.weapons[data.weaponKey] || this.weapons.pistol;
                const projectile = weapon.createProjectile(
                    shooter.x,
                    shooter.y,
                    data.targetX,
                    data.targetY,
                    data.playerId
                );
                // Damage boost is server-side only; visuals identical here
                this.projectileManager.addProjectile(projectile);
            }
        });

        // Player hit
        this.socket.on("playerHit", (data) => {
            console.log("Client: Received playerHit socket event:", data); // Debug log
            this.processPlayerHit(data);
        });

        // Ability result visuals
        this.socket.on("playerHealed", (data) => {
            const target = this.players.get(data.playerId);
            if (target) {
                target.health = data.newHealth;
                this.effectManager.addEffect({
                    id: `heal-${Date.now()}`,
                    x: target.x,
                    y: target.y,
                    type: "heal",
                    lifetime: 0.5,
                    maxLifetime: 0.5,
                });

                // Sound will be played by GameEngine.addEffect() based on effect type (healer sound)
            }
        });
        // Ability cooldown updates (per client)
        this.socket.on("abilityCooldown", (data) => {
            // data: { type, availableAt }
            if (!this.abilityCooldowns) this.abilityCooldowns = new Map();
            if (data && data.type) {
                this.abilityCooldowns.set(data.type, data.availableAt || Date.now());
            }
        });
        this.socket.on("abilityDenied", (data) => {
            // Optionally show feedback; for now just store cooldown if provided
            if (!this.abilityCooldowns) this.abilityCooldowns = new Map();
            if (data && data.type && data.availableAt) {
                this.abilityCooldowns.set(data.type, data.availableAt);
            }
        });
        this.socket.on("applySlow", (data) => {
            const target = this.players.get(data.playerId);
            if (target) {
                // apply local slow timer for movement reduction
                target.slowUntil = Date.now() + (data.duration || 0);
                // client visual marker
                this.effectManager.addEffect({
                    id: `slow-${Date.now()}`,
                    x: target.x,
                    y: target.y,
                    type: "speed",
                    lifetime: 1.0,
                    maxLifetime: 1.0,
                });

            }
        });

        // Handle player slowed by boss mob
        this.socket.on("playerSlowed", (data) => {
            const target = this.players.get(data.playerId);
            if (target) {
                // apply local slow timer for movement reduction
                target.slowUntil = Date.now() + (data.duration || 0);
                // client visual marker - use same effect as mage slow
                this.effectManager.addEffect({
                    id: `slow-${Date.now()}`,
                    x: target.x,
                    y: target.y,
                    type: "slow", // Use "slow" type like mage ability
                    lifetime: 1.0,
                    maxLifetime: 1.0,
                });

                // Sound will be played by GameEngine.addEffect() based on effect type
            }
        });
        this.socket.on("applyKnockback", (data) => {
            const target = this.players.get(data.playerId);
            if (target) {
                target.vx += data.vx;
                target.vy += data.vy;
                this.effectManager.addEffect({
                    id: `kb-${Date.now()}`,
                    x: target.x,
                    y: target.y,
                    type: "explosion",
                    radius: 35,
                    lifetime: 0.15,
                    maxLifetime: 0.15,
                });
            }
        });
        // Ability area visuals (always show)
        this.socket.on("abilityVisual", (data) => {
            const { type, x, y, radius, lifetime, playerId, angle } = data || {};
            if (type === "swing" && playerId) {
                const ply = this.players.get(playerId);
                if (!ply) return;
                const id = `swing-${Date.now()}`;
                this.effects.set(id, {
                    x: ply.x,
                    y: ply.y,
                    type: "explosion",
                    radius: radius || 60,
                    lifetime: lifetime || 0.2,
                    maxLifetime: lifetime || 0.2,
                    followPlayerId: playerId,
                });

                // Sound will be played by GameEngine.addEffect() based on effect type
                return;
            }
            if (type === "slam" && playerId) {
                const ply = this.players.get(playerId);
                if (!ply) {
                    return;
                }
                const id = `slam-${Date.now()}`;
                const effectData = {
                    x: ply.x,
                    y: ply.y,
                    type: "slam",
                    radius: radius || 100,
                    lifetime: lifetime || 0.3,
                    maxLifetime: lifetime || 0.3,
                    followPlayerId: playerId,
                };
                this.effects.set(id, effectData);

                // Sound will be played by GameEngine.addEffect() based on effect type
                return;
            }
            if (type === "meleeAttack" && playerId) {
                const ply = this.players.get(playerId);
                if (!ply) {
                    return;
                }
                const id = `meleeAttack-${Date.now()}`;
                const effectData = {
                    x: ply.x,
                    y: ply.y,
                    type: "meleeAttack",
                    angle: typeof angle === "number" ? angle : 0,
                    lifetime: lifetime || 0.3,
                    maxLifetime: lifetime || 0.3,
                    followPlayerId: playerId,
                };
                this.effects.set(id, effectData);
                return;
            }
            if (type === "blockStart" && playerId) {
                const ply = this.players.get(playerId);
                if (!ply) return;
                const id = `block-${playerId}`;
                this.effects.set(id, {
                    x: ply.x,
                    y: ply.y,
                    type: "block",
                    angle: typeof angle === "number" ? angle : 0,
                    lifetime: 9999,
                    maxLifetime: 9999,
                    followPlayerId: playerId,
                });

                // Play melee ability sound
                if (ply.className) {
                    this.soundManager.playAbilitySound(ply.className);
                } else {
                    this.soundManager.playSound("ability");
                }
                return;
            }
            if (type === "blockEnd" && playerId) {
                const id = `block-${playerId}`;
                if (this.effects.has(id)) this.effects.delete(id);
                return;
            }
            this.addEffect({
                id: `${type}-${Date.now()}`,
                x,
                y,
                type: type === "heal" ? "heal" : type === "slow" ? "slow" : "explosion",
                radius: radius || 30,
                lifetime: lifetime || 0.5,
                maxLifetime: lifetime || 0.5,
            });

        });

        // NPC updates
        this.socket.on("npcState", () => {
            // Deprecated: replaced by zombies
        });
        this.socket.on("npcShot", (data) => {
            // Also create a short-lived effect for muzzle flash
            if (!data) return;
            const id = `npc-beam-${Date.now()}`;
            this.effects.set(id, {
                x: data.fromX,
                y: data.fromY,
                type: "speed",
                radius: 40,
                lifetime: 0.15,
                maxLifetime: 0.15,
            });
        });
        this.socket.on("npcProjectile", () => {});

        // Projectile removal on impact (server-authoritative)
        this.socket.on("projectileHit", (data) => {
            if (!data) return;
            const { shooterId, hitX, hitY, penetrating } = data;

            // For penetrating projectiles, don't remove them
            if (penetrating) {
                // Create hit effect but keep projectile
                this.effectManager.addEffect({
                    id: `hit-${Date.now()}`,
                    x: hitX,
                    y: hitY,
                    type: "explosion",
                    radius: 15,
                    lifetime: 0.2,
                    maxLifetime: 0.2,
                });
                return;
            }

            // More aggressive projectile removal for better visual consistency
            // Remove ALL projectiles from this shooter within a reasonable radius
            const projectilesToRemove = [];

            this.projectiles.forEach((p, id) => {
                if (p.playerId !== shooterId) return;
                const dx = (p.x || 0) - hitX;
                const dy = (p.y || 0) - hitY;
                const distance = dx * dx + dy * dy;

                // Remove projectiles within 100px of hit point (more generous)
                if (distance <= 100 * 100) {
                    projectilesToRemove.push(id);
                }
            });

            // Remove all matching projectiles
            projectilesToRemove.forEach(id => {
                this.projectiles.delete(id);
                console.log(`Client: Removed projectile ${id} due to server hit confirmation`);
            });

            // No visual effect for ranger arrows - just clean projectile removal
        });

        // Handle projectile wall hits (server-authoritative)
        this.socket.on("projectileWallHit", (data) => {
            if (!data) return;
            const { x, y, projectileId, ownerId } = data;

            console.log(
                `Client: Received projectileWallHit event at (${x.toFixed(
          1
        )}, ${y.toFixed(1)}) for projectile ${projectileId}`
            );

            // Create distinctive wall hit effect
            this.addEffect({
                id: `wallHit-${Date.now()}`,
                x: x,
                y: y,
                type: "wallHit", // Special type for wall hits
                radius: 25,
                lifetime: 0.4,
                maxLifetime: 0.4,
            });

            // Remove the projectile that hit the wall
            if (projectileId && this.projectiles.has(projectileId)) {
                this.projectiles.delete(projectileId);
            } else {
                // Fallback: remove closest projectile from this owner near the hit point
                let closestProjectile = null;
                let closestDistance = Infinity;

                this.projectiles.forEach((p, id) => {
                    if (p.playerId !== ownerId) return;
                    const dx = (p.x || 0) - x;
                    const dy = (p.y || 0) - y;
                    const distance = dx * dx + dy * dy;

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestProjectile = id;
                    }
                });

                if (closestProjectile && closestDistance <= 100 * 100) {
                    // Within 100px of hit point
                    this.projectiles.delete(closestProjectile);
                }
            }
        });

        // Handle server-created projectiles (like penetrating arrows)
        this.socket.on("projectileCreate", (data) => {
            if (!data) return;
            const { id, x, y, vx, vy, size, color, playerId, penetrating } = data;

            this.projectiles.set(id, {
                id,
                x,
                y,
                vx,
                vy,
                size: size || 10,
                color: color || "#ffffff",
                playerId,
                penetrating: penetrating || false,
                lifetime: 5.0, // Match server TTL
                maxLifetime: 5.0,
            });

            // Sound will be played by GameEngine.addEffect() based on effect type
        });

        // Zombie waves
        this.socket.on("waveOver", (data) => {
            const nextInMs = (data && data.nextInMs) || 3000;
            const nextWave = (data && data.nextWave) || 1;
            this.gameStatusManager.showGameStatusBanner(
                `Wave cleared! Next wave (${nextWave}) in ${Math.ceil(
          nextInMs / 1000
        )}s`
            );
            // Update wave counter for next wave
            this.gameStatusManager.updateWaveCounter(nextWave);
        });
        this.socket.on("waveStarted", (data) => {
            const wave = (data && data.wave) || 1;
            this.gameStatusManager.updateWaveCounter(wave);
            this.gameStatusManager.showGameStatusBanner(`Wave ${wave} started!`);
        });

        // Handle score updates
        this.socket.on("scoreUpdate", (data) => {
            const { playerId, newScore } = data;
            const player = this.players.get(playerId);
            if (player) {
                player.score = newScore;
                this.gameStatusManager.updateScoreboard();
            }
        });

        // Handle player death
        this.socket.on("playerDeath", (data) => {
            const { playerId, playerName, livesRemaining, respawnIn, health } = data;

            console.log("Received playerDeath event:", data); // Debug log

            // Update the player's state
            const player = this.players.get(playerId);
            if (player) {
                player.isDead = true;
                player.lives = livesRemaining;
                player.health = health || 0; // Use health from server or default to 0

                // Update lives counter if this is the local player
                if (playerId === this.localPlayerId) {
                    this.gameStatusManager.updateLivesCounter();
                }
            }

            // Show death message
            if (playerId === this.localPlayerId) {
                this.gameStatusManager.showGameStatusBanner(
                    `You died! Respawning in ${
            respawnIn / 1000
          }s (${livesRemaining} lives left)`,
                    "warning"
                );
            } else {
                this.gameStatusManager.showGameStatusBanner(
                    `${playerName} died! Respawning in ${
            respawnIn / 1000
          }s (${livesRemaining} lives left)`
                );
            }
        });

        // Handle player elimination
        this.socket.on("playerEliminated", (data) => {
            const { playerId, playerName, health } = data;

            console.log("Received playerEliminated event:", data); // Debug log

            const player = this.players.get(playerId);
            if (player) {
                player.isDead = true;
                player.lives = 0;
                player.health = health || 0; // Use health from server or default to 0

                // If this is the local player, show game over
                if (playerId === this.localPlayerId) {
                    this.gameStatusManager.showGameStatusBanner(
                        "GAME OVER! You have been eliminated!",
                        "error"
                    );
                    this.playerLifecycleManager.disablePlayerInput();
                } else {
                    this.gameStatusManager.showGameStatusBanner(
                        `${playerName} was eliminated! (No lives remaining)`
                    );
                }
            }
        });

        // Handle player respawn
        this.socket.on("playerRespawn", (data) => {
            const { playerId, playerName, x, y, livesRemaining } = data;

            console.log("Client: Received playerRespawn event:", data); // Debug log

            this.gameStatusManager.showGameStatusBanner(
                `${playerName} respawned! (${livesRemaining} lives remaining)`
            );

            const player = this.players.get(playerId);
            if (player) {
                console.log(`Client: Resetting player ${playerId} state for respawn`); // Debug log
                player.isDead = false;
                player.lives = livesRemaining;
                player.x = x;
                player.y = y;
                player.health = 100;
                player.isInvulnerable = true;

                // Update lives counter if this is the local player
                if (playerId === this.localPlayerId) {
                    this.gameStatusManager.updateLivesCounter();
                }

                // Remove invulnerability after 3 seconds
                setTimeout(() => {
                    if (player) {
                        player.isInvulnerable = false;
                    }
                }, 3000);
            }
        });
        this.socket.on("zombiesState", (data) => {
            this.zombies.clear(); // Clear existing zombies instead of creating new Map
            const list = (data && data.zombies) || [];
            list.forEach((z) => {
                this.zombies.set(z.id, z);
            });
        });

        // Handle player state updates from server
        this.socket.on("playersState", (data) => {
            if (data && data.players) {

                data.players.forEach((playerData) => {
                    const existingPlayer = this.players.get(playerData.id);
                    if (existingPlayer) {
                        // Update existing player with server data
                        existingPlayer.name = playerData.name || existingPlayer.name;
                        existingPlayer.score = playerData.score || 0;
                        existingPlayer.lives = playerData.lives || 3;
                        existingPlayer.deaths = playerData.deaths || 0;
                        existingPlayer.kills = playerData.kills || 0;
                        existingPlayer.isDead = playerData.isDead || false;
                        existingPlayer.health = playerData.health || 100;
                    }
                });

                // Update scoreboard after player state sync
                this.gameStatusManager.updateScoreboard();
            }
        });

        // Game paused
        this.socket.on("gamePaused", (data) => {
            this.gameStateManager.pauseGame(data.pausedBy);
        });

        // Game resumed
        this.socket.on("gameResumed", (data) => {
            this.gameStateManager.resumeGame(data.resumedBy);
        });

        // Game quit
        this.socket.on("gameQuit", (data) => {
            this.gameStateManager.quitGame(data.quitBy);
        });

        // Game restart
        this.socket.on("lobbyUpdate", (data) => {
            // Check if this is a restart (game state changed to waiting)
            if (data.gameState === "waiting" && this.gameStateManager.isRunning) {
                this.gameStateManager.restartGame("Host");
            }
        });

        // Game end
        this.socket.on("gameEnd", (data) => {
            this.gameStateManager.endGame(data.winner);
        });
    }

    processPlayerHit(data) {
        console.log("Client: Received playerHit event:", data); // Debug log

        const targetPlayer = this.players.get(data.targetId);
        if (targetPlayer) {
            console.log(
                `Client: Updating player ${data.targetId} health from ${targetPlayer.health} to ${data.newHealth}`
            ); // Debug log
            targetPlayer.health = data.newHealth;
        }

        // Update scoreboard
        this.updateScoreboard();

        // Play hit sound
        this.soundManager.playSound("hit");

        // Client-side class effects visuals (non-authoritative)
        const shooter = this.players.get(data.shooterId);
        if (shooter && shooter.className === "ranged") {
            // slight recoil effect
            this.addEffect({
                id: `ranged-hit-${Date.now()}`,
                x: targetPlayer ? targetPlayer.x : 0,
                y: targetPlayer ? targetPlayer.y : 0,
                type: "speed",
                lifetime: 0.2,
                maxLifetime: 0.2,
            });
        }
    }

    updateLobbyInfoInternal(data) {
        // Update player count
        const playerCountElement = document.getElementById("playerCount");
        if (playerCountElement) {
            playerCountElement.textContent = `${data.players.length}/4`;
        }

        // Update players list
        const playersListElement = document.getElementById("playersList");
        if (playersListElement) {
            playersListElement.innerHTML = data.players
                .map(
                    (player) => `
                    <div class="player-item">
                        <span class="player-name">${player.name}</span>
                        <span class="player-host">${
                          player.id === this.localPlayerId ? "You" : "Player"
                        }</span>
                    </div>
                `
                )
                .join("");
        }

        // Update start button
        const startGameBtn = document.getElementById("startGameBtn");
        if (startGameBtn) {
            // @ts-ignore
            (startGameBtn).disabled = data.players.length < 2;
        }
    }

    // Update references when GameEngine properties change
    updateReferences(socket, players, localPlayerId, zombies, projectiles, effects, abilityCooldowns,
        updateLobbyInfo, addEffect, projectileManager, effectManager,
        gameStatusManager, gameStateManager, playerLifecycleManager, soundManager,
        updateScoreboard, addProjectile, weapons) {
        this.socket = socket;
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.zombies = zombies;
        this.projectiles = projectiles;
        this.effects = effects;
        this.abilityCooldowns = abilityCooldowns;
        // updateLobbyInfo handled internally, no external reference needed
        this.addEffect = addEffect;
        this.projectileManager = projectileManager;
        this.effectManager = effectManager;
        this.gameStatusManager = gameStatusManager;
        this.gameStateManager = gameStateManager;
        this.playerLifecycleManager = playerLifecycleManager;
        this.soundManager = soundManager;
        this.updateScoreboard = updateScoreboard;
        this.addProjectile = addProjectile;
        this.weapons = weapons;
    }
}

// Make NetworkManager available globally
// @ts-ignore
window.NetworkManager = NetworkManager;