const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const config = require('./config/gameConfig');
const GameManager = require('./game/GameManager');
const { setupLobbyHandlers } = require('./socket/lobbyHandlers');
const { inferWeaponKeyFromClass, normalizeWeapon } = require('./utils/weaponUtils');
const gameRoutes = require('./routes/game');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: config.cors,
});

// Initialize game manager
const gameManager = new GameManager();
gameManager.setIO(io);

// Use game routes
app.use('/', gameRoutes);

// Handle 404
app.use((req, res) => {
    res.status(404).end();
});

// Socket.IO connection handling
io.on("connection", (socket) => {

    // Add error handling for individual socket
    socket.on('error', (error) => {
        console.error('Socket error for', socket.id, ':', error);
    });

    // Set up all socket handlers
    setupLobbyHandlers(socket, gameManager, io);

    // Player movement
    socket.on("playerMove", (data) => {
        const { x, y } = data;
        const playerData = gameManager.getPlayer(socket.id);

        if (playerData) {
            const lobby = gameManager.getLobby(playerData.lobbyId);
            if (lobby && lobby.gameState === "playing") {
                lobby.updatePlayerPosition(socket.id, x, y);

                // Emit movement to other players
                socket.to(playerData.lobbyId).emit("playerMoved", {
                    playerId: socket.id,
                    x,
                    y,
                });
            }
        }
    });

    // Player shot
    socket.on("playerShot", (data) => {
        try {
            const { targetX, targetY, weapon, weaponKey } = data;
            const playerData = gameManager.getPlayer(socket.id);

            if (playerData) {
                const lobby = gameManager.getLobby(playerData.lobbyId);
                if (lobby && lobby.gameState === "playing") {
                    const shooter = lobby.players.get(socket.id);

                    // Special handling for melee attacks - no projectile, direct hit check
                    if (shooter && shooter.chosenClass === "melee") {
                        // Melee attack: check for hits in melee range directly
                        const meleeRange = 120; // 2x zombie hit range for better hit registration

                        // Hit players (only in deathmatch mode)
                        if (lobby.gameMode === "deathmatch") {
                            lobby.players.forEach((target, targetId) => {
                                if (targetId === socket.id) return; // Can't hit self

                                const dx = target.x - shooter.x;
                                const dy = target.y - shooter.y;
                                const distance = Math.sqrt(dx * dx + dy * dy);

                                if (distance <= meleeRange) {
                                    // Check if target is in the direction of the attack
                                    const attackAngle = Math.atan2(
                                        targetY - shooter.y,
                                        targetX - shooter.x
                                    );
                                    const targetAngle = Math.atan2(dy, dx);
                                    const angleDiff = Math.abs(attackAngle - targetAngle);

                                    // Allow some angle tolerance (about 45 degrees)
                                    if (angleDiff <= Math.PI / 4 || angleDiff >= (7 * Math.PI) / 4) {
                                        const damage = 45; // Base melee damage
                                        const finalDamage = target.isBlocking ?
                                            Math.floor(damage * 0.3) :
                                            damage;

                                        target.health = Math.max(0, target.health - finalDamage);

                                        // Emit hit event
                                        io.to(playerData.lobbyId).emit("playerHit", {
                                            shooterId: socket.id,
                                            targetId: targetId,
                                            newHealth: target.health,
                                            damage: finalDamage,
                                        });

                                        // Check for death
                                        if (target.health <= 0) {
                                            // Award kill points for melee PvP kills (only if target wasn't already dead)
                                            if (!target.isDead) {
                                                shooter.kills++;
                                                shooter.score = (shooter.score || 0) + 100; // 100 points for PvP kill
                                                io.to(playerData.lobbyId).emit("scoreUpdate", {
                                                    playerId: socket.id,
                                                    newScore: shooter.score,
                                                });
                                            }
                                            lobby.playerSystem.handlePlayerDeath(targetId);
                                        }

                                        // If target was blocking, charge up melee player
                                        if (target.isBlocking) {
                                            shooter.meleeCharge = Math.min(
                                                100,
                                                (shooter.meleeCharge || 0) + 20
                                            );
                                        }
                                    }
                                }
                            });
                        }

                        // Hit zombies
                        if (lobby.waveManager && lobby.waveManager.zombies) {
                            lobby.waveManager.zombies.forEach((zombie, zombieId) => {
                                const dx = zombie.x - shooter.x;
                                const dy = zombie.y - shooter.y;
                                const distance = Math.sqrt(dx * dx + dy * dy);

                                if (distance <= meleeRange) {
                                    // Check if zombie is in the direction of the attack
                                    const attackAngle = Math.atan2(
                                        targetY - shooter.y,
                                        targetX - shooter.x
                                    );
                                    const zombieAngle = Math.atan2(dy, dx);
                                    let angleDiff = Math.abs(attackAngle - zombieAngle);

                                    // Normalize angle difference to [0, π]
                                    if (angleDiff > Math.PI) {
                                        angleDiff = 2 * Math.PI - angleDiff;
                                    }

                                    // Allow wider angle tolerance (90 degrees) for better hit registration
                                    if (angleDiff <= Math.PI / 2) {
                                        const damage = 45; // Base melee damage
                                        zombie.health = Math.max(0, zombie.health - damage);

                                        // Award points for hitting zombie
                                        shooter.score = (shooter.score || 0) + 1;
                                        io.to(playerData.lobbyId).emit("scoreUpdate", {
                                            playerId: socket.id,
                                            newScore: shooter.score,
                                        });

                                        // If zombie dies, award bonus points and remove it
                                        if (zombie.health <= 0) {
                                            lobby.waveManager.zombies.delete(zombieId);
                                            shooter.score = (shooter.score || 0) + 8;
                                            io.to(playerData.lobbyId).emit("scoreUpdate", {
                                                playerId: socket.id,
                                                newScore: shooter.score,
                                            });
                                        }
                                    }
                                }
                            });
                        }

                        // Emit melee attack visual to all clients
                        io.to(playerData.lobbyId).emit("abilityVisual", {
                            type: "meleeAttack",
                            x: shooter.x,
                            y: shooter.y,
                            angle: Math.atan2(targetY - shooter.y, targetX - shooter.x) *
                                (180 / Math.PI),
                            lifetime: 0.3,
                            playerId: socket.id,
                        });

                        return; // Don't process as projectile
                    }

                    if (shooter && shooter.chosenClass === "mage") {
                        // Double parallel bolts: compute slight perpendicular offset
                        const dx = targetX - shooter.x;
                        const dy = targetY - shooter.y;
                        const len = Math.max(1e-6, Math.hypot(dx, dy));
                        const nx = -dy / len; // perpendicular
                        const ny = dx / len;
                        const spread = 12; // pixels between parallel paths

                        // Use server-only weapon stats (ignore client data completely)
                        const w = normalizeWeapon(weaponKey, null, shooter.chosenClass);
                        // Simulate two projectiles server-side for timing-accurate hits
                        lobby.spawnSimulatedProjectile(
                            socket.id,
                            shooter.x,
                            shooter.y,
                            targetX + nx * spread,
                            targetY + ny * spread,
                            w
                        );
                        lobby.spawnSimulatedProjectile(
                            socket.id,
                            shooter.x,
                            shooter.y,
                            targetX - nx * spread,
                            targetY - ny * spread,
                            w
                        );

                        io.to(playerData.lobbyId).emit("playerShot", {
                            playerId: socket.id,
                            targetX: targetX + nx * spread,
                            targetY: targetY + ny * spread,
                            weapon,
                            weaponKey: weaponKey || inferWeaponKeyFromClass(shooter.chosenClass),
                        });
                        io.to(playerData.lobbyId).emit("playerShot", {
                            playerId: socket.id,
                            targetX: targetX - nx * spread,
                            targetY: targetY - ny * spread,
                            weapon,
                            weaponKey: weaponKey || inferWeaponKeyFromClass(shooter.chosenClass),
                        });
                    } else {
                        const w = normalizeWeapon(weaponKey, null, shooter.chosenClass);
                        lobby.spawnSimulatedProjectile(
                            socket.id,
                            shooter.x,
                            shooter.y,
                            targetX,
                            targetY,
                            w
                        );
                        io.to(playerData.lobbyId).emit("playerShot", {
                            playerId: socket.id,
                            targetX,
                            targetY,
                            weapon,
                            weaponKey: weaponKey || inferWeaponKeyFromClass(shooter.chosenClass),
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error in playerShot handler:', error);
            console.error('Stack:', error.stack);
        }
    });

    // Ability use (authoritative)
    socket.on("abilityUse", (data) => {
        try {
            const { lobbyId, type, x, y, angle } = data;
            const playerData = gameManager.getPlayer(socket.id);
            if (!playerData) return;

            const lobby = gameManager.getLobby(lobbyId);
            if (!lobby) return;
            const user = lobby.players.get(socket.id);
            if (!user) return;

            // Cooldown enforcement
            const ABILITY_COOLDOWNS = {
                healer_heal: 3000,
                mage_slow: 8000,
                penetrating_arrow: 4000, // 4 second cooldown for powerful penetrating arrow
                melee_slam: 6000, // 6 second cooldown for melee slam
            };
            if (!user.abilityCooldowns) user.abilityCooldowns = {};
            const now = Date.now();
            if (ABILITY_COOLDOWNS[type]) {
                const last = user.abilityCooldowns[type] || 0;
                const cd = ABILITY_COOLDOWNS[type];
                if (now - last < cd) {
                    socket.emit("abilityDenied", { type, availableAt: last + cd });
                    return;
                }
                user.abilityCooldowns[type] = now;
                socket.emit("abilityCooldown", { type, availableAt: now + cd });
            }

            switch (type) {
                case "healer_heal":
                    {
                        // Slightly larger than a player (~1.5x typical diameter)
                        const radius = 60; // Larger radius for better usability

                        // In deathmatch mode, heal damages other players and heals self
                        if (lobby.gameMode === "deathmatch") {
                            lobby.players.forEach((p, pid) => {
                                if (pid === socket.id) {
                                    // Heal self
                                    const before = p.health;
                                    p.health = Math.min(100, p.health + 20);
                                    const healed = Math.max(0, p.health - before);
                                    // No points awarded for self-healing in deathmatch
                                    io.to(lobbyId).emit("playerHealed", {
                                        playerId: pid,
                                        newHealth: p.health,
                                    });
                                } else {
                                    // Damage other players
                                    const dx = p.x - x;
                                    const dy = p.y - y;
                                    if (dx * dx + dy * dy <= radius * radius) {
                                        const damage = 25; // Healer magic damage to other players
                                        p.health = Math.max(0, p.health - damage);

                                        // No points awarded for damaging other players with heal

                                        // Emit hit event for damage
                                        io.to(lobbyId).emit("playerHit", {
                                            shooterId: socket.id,
                                            targetId: pid,
                                            newHealth: p.health,
                                            damage: damage,
                                        });

                                        // Check for death
                                        if (p.health <= 0) {
                                            lobby.playerSystem.handlePlayerDeath(pid);
                                            // Award kill points (only if target wasn't already dead)
                                            if (!p.isDead) {
                                                const healer = lobby.players.get(socket.id);
                                                if (healer) {
                                                    healer.kills++;
                                                    healer.score = (healer.score || 0) + 100; // 100 points for PvP kill
                                                    io.to(lobbyId).emit("scoreUpdate", {
                                                        playerId: socket.id,
                                                        newScore: healer.score,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                        } else {
                            // Survival mode: normal healing behavior
                            lobby.players.forEach((p, pid) => {
                                const dx = p.x - x;
                                const dy = p.y - y;
                                if (dx * dx + dy * dy <= radius * radius) {
                                    const before = p.health;
                                    p.health = Math.min(100, p.health + 20);
                                    // Award healer points for effective healing (balanced)
                                    const healed = Math.max(0, p.health - before);
                                    if (healed > 0) {
                                        const healer = lobby.players.get(socket.id);
                                        if (healer) {
                                            healer.score = (healer.score || 0) + Math.ceil(healed / 4); // Reduced healing points
                                            io.to(lobbyId).emit("scoreUpdate", {
                                                playerId: socket.id,
                                                newScore: healer.score,
                                            });
                                        }
                                    }
                                    io.to(lobbyId).emit("playerHealed", {
                                        playerId: pid,
                                        newHealth: p.health,
                                    });
                                }
                            });
                        }

                        // Damage zombies (healer magic hurts undead)
                        let zombiesDamaged = 0;
                        const zombieDamage = 45; // Magic damage to zombies
                        if (lobby.waveManager && lobby.waveManager.zombies) {
                            lobby.waveManager.zombies.forEach((z, zid) => {
                                const dx = z.x - x;
                                const dy = z.y - y;
                                if (dx * dx + dy * dy <= radius * radius) {
                                    z.health = Math.max(0, z.health - zombieDamage);
                                    zombiesDamaged++;

                                    // Award points for hitting zombie with heal
                                    const healer = lobby.players.get(socket.id);
                                    if (healer) {
                                        healer.score = (healer.score || 0) + 2;
                                        io.to(lobbyId).emit("scoreUpdate", {
                                            playerId: socket.id,
                                            newScore: healer.score,
                                        });
                                    }

                                    // If zombie dies, award bonus points and remove it
                                    if (z.health <= 0) {
                                        lobby.waveManager.zombies.delete(zid);
                                        if (healer) {
                                            healer.score = (healer.score || 0) + 10;
                                            io.to(lobbyId).emit("scoreUpdate", {
                                                playerId: socket.id,
                                                newScore: healer.score,
                                            });
                                        }
                                    }
                                }
                            });
                        }

                        if (zombiesDamaged > 0) {
                            console.log(`Healer magic damaged ${zombiesDamaged} zombies`);
                        }

                        // Broadcast visual to all clients so everyone sees the AoE
                        io.to(lobbyId).emit("abilityVisual", {
                            type: "heal",
                            x,
                            y,
                            radius,
                            lifetime: 0.5,
                        });
                        break;
                    }
                case "mage_slow":
                    {
                        const radius = 80; // Larger radius to make it easier to hit zombies
                        const duration = 5000; // 5 seconds persistent area

                        // Create persistent slow area effect
                        const effectId = lobby.areaEffectManager.addAreaEffect({
                            type: "slow",
                            x: x,
                            y: y,
                            radius: radius,
                            casterId: socket.id,
                            createdAt: Date.now(),
                            expiresAt: Date.now() + duration,
                        });


                        // In deathmatch mode, also apply slow to other players
                        if (lobby.gameMode === "deathmatch") {
                            lobby.players.forEach((p, pid) => {
                                if (pid !== socket.id) { // Don't slow self
                                    const dx = p.x - x;
                                    const dy = p.y - y;
                                    if (dx * dx + dy * dy <= radius * radius) {
                                        // Apply slow effect to other players
                                        p.slowUntil = Date.now() + duration;
                                        io.to(lobbyId).emit("applySlow", {
                                            playerId: pid,
                                            duration: duration,
                                            casterId: socket.id,
                                            casterClass: user.className
                                        });

                                        // No points awarded for slowing other players
                                    }
                                }
                            });
                        }

                        // Broadcast area visual with longer lifetime to match persistent effect
                        io.to(lobbyId).emit("abilityVisual", {
                            type: "slow",
                            x,
                            y,
                            radius,
                            lifetime: duration / 1000, // Convert to seconds for client
                            playerId: socket.id,
                            casterClass: user.className
                        });
                        break;
                    }
                case "penetrating_arrow":
                    {
                        const { x: targetX, y: targetY } = data;
                        if (typeof targetX !== "number" || typeof targetY !== "number") return;

                        // Create a large, slow penetrating arrow projectile
                        const arrowId = `penetrating-${Date.now()}-${Math.random()}`;
                        const dx = targetX - user.x;
                        const dy = targetY - user.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance === 0) return; // Can't shoot at self

                        const angle = Math.atan2(dy, dx);
                        const speed = 1000; // 2.5x faster than before (was 400, now 1000)
                        const damage = 60; // Higher damage than regular arrows (regular is 40)
                        const projectileSize = 8; // Skinnier than before, but still bigger than regular arrows (regular is 4)

                        const penetratingArrow = {
                            id: arrowId,
                            x: user.x,
                            y: user.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            speed: speed,
                            damage: damage,
                            size: projectileSize,
                            ttl: 5.0, // 5 seconds lifetime
                            ownerId: socket.id, // Use ownerId to match collision detection
                            penetrating: true, // Special flag for penetrating projectiles
                            hitTargets: new Set(), // Track what this arrow has already hit
                            color: "#ff6b00", // Orange color for special arrow
                        };

                        // Add to simulated projectiles for collision detection
                        if (!lobby.simProjectiles) lobby.simProjectiles = new Map();
                        lobby.simProjectiles.set(arrowId, penetratingArrow);

                        // Broadcast the special projectile to all clients for visual
                        io.to(lobbyId).emit("projectileCreate", {
                            id: arrowId,
                            x: user.x,
                            y: user.y,
                            vx: penetratingArrow.vx,
                            vy: penetratingArrow.vy,
                            size: projectileSize,
                            color: "#ff6b00",
                            playerId: socket.id,
                            penetrating: true, // Let clients know this is special
                        });

                        break;
                    }
                case "melee_slam":
                    {
                        const radius = 150; // Even larger radius for area knockback
                        const strength = 800; // Massive knockback force (same as range distance)
                        const damage = 45; // Slightly higher damage

                        // Affect players (only in deathmatch mode)
                        if (lobby.gameMode === "deathmatch") {
                            lobby.players.forEach((p, pid) => {
                                if (pid === socket.id) return;
                                const dx = p.x - user.x;
                                const dy = p.y - user.y;
                                const d2 = dx * dx + dy * dy;
                                if (d2 <= radius * radius && d2 > 0) {
                                    const dist = Math.sqrt(d2);
                                    const nx = dx / dist;
                                    const ny = dy / dist;
                                    io.to(lobbyId).emit("applyKnockback", {
                                        playerId: pid,
                                        vx: nx * strength,
                                        vy: ny * strength,
                                    });
                                    // Apply damage
                                    p.health = Math.max(0, p.health - damage);
                                    io.to(lobbyId).emit("playerHit", {
                                        shooterId: socket.id,
                                        targetId: pid,
                                        newHealth: p.health,
                                        damage,
                                    });

                                    // Check for death
                                    if (p.health <= 0) {
                                        lobby.playerSystem.handlePlayerDeath(pid);
                                        // Award kill points (only if target wasn't already dead)
                                        if (!p.isDead) {
                                            const slammer = lobby.players.get(socket.id);
                                            if (slammer) {
                                                slammer.kills++;
                                                slammer.score = (slammer.score || 0) + 100; // 100 points for PvP kill
                                                io.to(lobbyId).emit("scoreUpdate", {
                                                    playerId: socket.id,
                                                    newScore: slammer.score,
                                                });
                                            }
                                        }
                                    }
                                }
                            });
                        }

                        // Affect zombies
                        if (lobby.waveManager.zombies) {
                            lobby.waveManager.zombies.forEach((z, zid) => {
                                const dx = z.x - user.x;
                                const dy = z.y - user.y;
                                const d2 = dx * dx + dy * dy;
                                if (d2 <= radius * radius && d2 > 0) {
                                    // Apply damage to zombie
                                    z.health = Math.max(0, z.health - damage);

                                    // Apply knockback to zombie
                                    const dist = Math.sqrt(d2);
                                    const nx = dx / dist;
                                    const ny = dy / dist;
                                    const zombieKnockback = strength * 0.6; // Zombies get 60% of player knockback

                                    // Apply knockback velocity to zombie
                                    z.vx = nx * zombieKnockback;
                                    z.vy = ny * zombieKnockback;

                                    // Add a small delay before zombie can move again (stunned effect)
                                    z.stunnedUntil = Date.now() + 500; // 0.5 second stun

                                    // Award points for hitting zombie
                                    const shooter = lobby.players.get(socket.id);
                                    if (shooter) {
                                        shooter.score = (shooter.score || 0) + 2; // Points for ability hit
                                        io.to(lobbyId).emit("scoreUpdate", {
                                            playerId: socket.id,
                                            newScore: shooter.score,
                                        });
                                    }

                                    // If zombie dies, award bonus points and remove it
                                    if (z.health <= 0) {
                                        lobby.waveManager.zombies.delete(zid);
                                        if (shooter) {
                                            shooter.score = (shooter.score || 0) + 12; // Bonus for kill with ability
                                            io.to(lobbyId).emit("scoreUpdate", {
                                                playerId: socket.id,
                                                newScore: shooter.score,
                                            });
                                        }
                                    }
                                }
                            });
                        }

                        // Broadcast slam visual around the user
                        io.to(lobbyId).emit("abilityVisual", {
                            type: "slam",
                            x: user.x,
                            y: user.y,
                            playerId: socket.id,
                            radius,
                            lifetime: 0.4, // Slightly longer visual for bigger impact
                        });
                        break;
                    }
            }
        } catch (error) {
            console.error('Error in abilityUse handler:', error);
            console.error('Stack:', error.stack);
        }
    });

    // Pause/Resume clients (server tracks pause state to stop updates)
    socket.on("togglePause", (data) => {
        const { lobbyId } = data;
        const playerData = gameManager.getPlayer(socket.id);
        if (!playerData) return;
        const lobby = gameManager.getLobby(lobbyId);
        if (!lobby) return;

        // Only allow host or any player to pause/resume during game
        if (lobby.gameState !== "playing") return;

        lobby.clientPaused = !lobby.clientPaused;
        if (lobby.clientPaused) {
            io.to(lobbyId).emit("gamePaused", { pausedBy: playerData.playerName });
        } else {
            io.to(lobbyId).emit("gameResumed", { resumedBy: playerData.playerName });
            // Reset timing anchors to avoid a jump
            lobby.lastUpdate = Date.now();
        }
    });

    // Quit game
    socket.on("quitGame", (data) => {
        const { lobbyId } = data;
        const lobby = gameManager.getLobby(lobbyId);
        const playerData = gameManager.getPlayer(socket.id);

        if (lobby && lobby.gameState === "playing" && playerData) {
            io.to(lobbyId).emit("gameQuit", {
                quitBy: playerData.playerName,
            });

            // End game and delete lobby immediately
            lobby.endGame();

            // Delete lobby immediately after a short delay to let players see the quit message
            setTimeout(() => {
                gameManager.removeLobby(lobbyId);
                io.to(lobbyId).emit("lobbyDeleted", {
                    message: "Lobby has been deleted"
                });
            }, 3000); // 3 seconds delay
        }
    });

    // Restart game
    socket.on("restartGame", (data) => {
        const { lobbyId } = data;
        const lobby = gameManager.getLobby(lobbyId);
        const playerData = gameManager.getPlayer(socket.id);

        if (lobby && playerData) {

            // Emit restart notification to all players
            io.to(lobbyId).emit("gameRestarted", {
                restartedBy: playerData.playerName,
            });

            // Reset the lobby to waiting state immediately
            lobby.gameState = "waiting";
            lobby.gameStartTime = null;

            // Clear all game data
            if (lobby.waveManager.zombies) lobby.waveManager.zombies.clear();
            if (lobby.simProjectiles) lobby.simProjectiles.clear();
            if (lobby.areaEffectManager) lobby.areaEffectManager.clearAllEffects();

            // Stop any running game timers
            if (lobby.gameTimer) {
                clearTimeout(lobby.gameTimer);
                lobby.gameTimer = null;
            }
            if (lobby.waveInterval) {
                clearInterval(lobby.waveInterval);
                lobby.waveInterval = null;
            }
            if (lobby.waveCountdownTimeout) {
                clearTimeout(lobby.waveCountdownTimeout);
                lobby.waveCountdownTimeout = null;
            }

            // Reset player states
            lobby.players.forEach((player, playerId) => {
                player.health = 100;
                player.score = 0;
                player.kills = 0;
                player.deaths = 0;
                player.lives = 3;
                player.isDead = false;
                player.respawnTime = 0;
                player.lastShot = 0;
                player.meleeCharge = 0;
                player.isInvulnerable = false;
                player.slowUntil = 0;
                player.abilityCooldowns = {};
            });

            // Emit updated lobby state
            io.to(lobbyId).emit("lobbyUpdate", {
                players: Array.from(lobby.players.values()),
                gameState: lobby.gameState,
                gameStartTime: lobby.gameStartTime,
                gameMode: lobby.gameMode,
            });

        }
    });

    // Handle disconnect
    socket.on("disconnect", () => {

        const playerData = gameManager.getPlayer(socket.id);
        if (playerData) {
            const lobby = gameManager.getLobby(playerData.lobbyId);
            if (lobby) {
                lobby.removePlayer(socket.id);

                // Notify other players
                socket.to(playerData.lobbyId).emit("playerLeft", {
                    playerId: socket.id,
                    players: Array.from(lobby.players.values()),
                });

                // If lobby is empty, remove it
                if (lobby.players.size === 0) {
                    gameManager.removeLobby(playerData.lobbyId);
                    // Emit updated lobby list when lobby is removed
                    gameManager.emitLobbyList();
                }
            }
            gameManager.removePlayer(socket.id);
        }
    });
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Socket.IO error handling
io.on('error', (error) => {
    console.error('Socket.IO Error:', error);
});

// Start server
server.listen(config.PORT, () => {
    console.log(` Server running on port ${config.PORT}`);
    console.log(` Game URL: http://localhost:${config.PORT}`);
});

module.exports = { app, server, io, gameManager };