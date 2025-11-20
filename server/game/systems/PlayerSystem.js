// Player management and game mechanics
class PlayerSystem {
    constructor(lobby) {
        this.lobby = lobby;
    }

    updatePlayerPosition(playerId, x, y) {
        const player = this.lobby.players.get(playerId);
        if (player) {
            player.x = x;
            player.y = y;
        }
    }

    updatePlayerStates(dt) {
        this.lobby.playersBroadcastAccum = (this.lobby.playersBroadcastAccum || 0) + dt;
        if (this.lobby.playersBroadcastAccum >= 0.1) {
            this.lobby.playersBroadcastAccum = 0;
            if (this.lobby.players && this.lobby.players.size > 0) {
                const playersList = Array.from(this.lobby.players.values()).map((p) => ({
                    id: p.id,
                    name: p.name,
                    score: p.score,
                    lives: p.lives,
                    deaths: p.deaths,
                    kills: p.kills,
                    isDead: p.isDead,
                    health: p.health,
                }));
                if (this.lobby.io) {
                    this.lobby.io.to(this.lobby.id).emit("playersState", { players: playersList });
                }
            }
        }
    }

    handlePlayerDeath(playerId) {
        try {
            const player = this.lobby.players.get(playerId);
            if (!player) {
                console.log(`HandlePlayerDeath: Player ${playerId} not found`);
                return;
            }
            if (player.isDead) {
                console.log(`HandlePlayerDeath: Player ${playerId} already dead`);
                return;
            }

            // Player dies
            player.isDead = true;
            player.health = 0;
            player.deaths++;
            player.lives--;

            console.log(`Player ${player.name} died. Lives remaining: ${player.lives}`);

            if (player.lives > 0) {
                // Set respawn time (5 seconds from now)
                player.respawnTime = Date.now() + 5000;

                // Notify clients about death and respawn timer
                const deathEvent = {
                    playerId: playerId,
                    playerName: player.name,
                    livesRemaining: player.lives,
                    respawnIn: 5000,
                    health: 0,
                };

                if (this.lobby.io && this.lobby.id) {
                    this.lobby.io.to(this.lobby.id).emit("playerDeath", deathEvent);
                    console.log(`Death event emitted for player ${playerId}`);
                } else {
                    console.error('Cannot emit death event: io or lobby.id is null');
                }

                // Schedule respawn
                const respawnTimeout = setTimeout(() => {
                    this.respawnPlayer(playerId);
                }, 5000);

                // Store the timeout ID for potential cancellation
                player.respawnTimeoutId = respawnTimeout;
            } else {
                // No lives left - permanent death
                const eliminationEvent = {
                    playerId: playerId,
                    playerName: player.name,
                    health: 0,
                };

                if (this.lobby.io && this.lobby.id) {
                    this.lobby.io.to(this.lobby.id).emit("playerEliminated", eliminationEvent);
                    console.log(`Elimination event emitted for player ${playerId}`);
                } else {
                    console.error('Cannot emit elimination event: io or lobby.id is null');
                }

                // Check if deathmatch should end after player elimination
                if (this.lobby.gameMode === "deathmatch") {
                    this.checkDeathmatchEnd();
                }
            }

            // Check if deathmatch should end (only one player remaining)
            if (this.lobby.gameMode === "deathmatch") {
                this.checkDeathmatchEnd();
            }
        } catch (error) {
            console.error('Error in handlePlayerDeath:', error);
            console.error('Stack:', error.stack);
        }
    }

    checkDeathmatchEnd() {
        // Count alive players (players with lives remaining)
        let alivePlayers = 0;
        let lastAlivePlayer = null;

        this.lobby.players.forEach((player) => {
            if (player.lives > 0) {
                alivePlayers++;
                lastAlivePlayer = player;
            }
        });

        // If only one player remains alive, end the deathmatch
        if (alivePlayers <= 1) {

            // Find the winner (player with least deaths, then highest score as tiebreaker)
            let winner = null;
            let leastDeaths = Infinity;
            let highestScore = -1;

            this.lobby.players.forEach((player) => {
                // Prioritize least deaths
                if (player.deaths < leastDeaths ||
                    (player.deaths === leastDeaths && player.score > highestScore)) {
                    leastDeaths = player.deaths;
                    highestScore = player.score;
                    winner = {
                        id: player.id,
                        name: player.name,
                        score: player.score,
                        kills: player.kills,
                        deaths: player.deaths
                    };
                }
            });

            // End the game
            this.lobby.endGame();
        }
    }

    respawnPlayer(playerId) {
        try {
            const player = this.lobby.players.get(playerId);
            if (!player) {
                console.log(`RespawnPlayer: Player ${playerId} not found`);
                return;
            }
            if (!player.isDead) {
                console.log(`RespawnPlayer: Player ${playerId} is not dead`);
                return;
            }
            if (player.lives <= 0) {
                console.log(`RespawnPlayer: Player ${playerId} has no lives left`);
                return;
            }

            // Clear any existing respawn timeout
            if (player.respawnTimeoutId) {
                clearTimeout(player.respawnTimeoutId);
                player.respawnTimeoutId = null;
            }

            // Reset player state
            player.isDead = false;
            player.health = 100;
            player.respawnTime = 0;

            // Find safe spawn location
            player.x = Math.random() * 600 + 100;
            player.y = Math.random() * 400 + 100;

            // Brief invulnerability
            player.isInvulnerable = true;

            setTimeout(() => {
                if (this.lobby.players.has(playerId)) {
                    const player = this.lobby.players.get(playerId);
                    if (player) {
                        player.isInvulnerable = false;
                    }
                }
            }, 3000);

            // Notify clients about respawn
            const respawnEvent = {
                playerId: playerId,
                playerName: player.name,
                x: player.x,
                y: player.y,
                livesRemaining: player.lives,
            };

            if (this.lobby.io && this.lobby.id) {
                this.lobby.io.to(this.lobby.id).emit("playerRespawn", respawnEvent);
                console.log(`Player ${playerId} respawned at (${player.x}, ${player.y})`);
            } else {
                console.error('Cannot emit respawn event: io or lobby.id is null');
            }
        } catch (error) {
            console.error('Error in respawnPlayer:', error);
            console.error('Stack:', error.stack);
        }
    }

    respawnNPC() {
        if (!this.lobby.npc) return;
        // Move to a random valid location within world bounds used on client (1200x800)
        const W = 1200;
        const H = 800;
        this.lobby.npc.x = Math.random() * (W - 200) + 100;
        this.lobby.npc.y = Math.random() * (H - 200) + 100;
        this.lobby.npc.health = this.lobby.npc.maxHealth;
        if (this.lobby.io) {
            this.lobby.io.to(this.lobby.id).emit("npcState", { npc: this.lobby.npc });
        }
    }
}

module.exports = PlayerSystem;