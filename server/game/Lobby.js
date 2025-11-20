const { v4: uuidv4 } = require("uuid");
const config = require('../config/gameConfig');
const { inferWeaponKeyFromClass } = require('../utils/weaponUtils');
const PhysicsSystem = require('./systems/PhysicsSystem');
const ProjectileSystem = require('./systems/ProjectileSystem');
const PlayerSystem = require('./systems/PlayerSystem');
const WaveManager = require('./WaveManager');
const ZombieAI = require('./ZombieAI');
const CollisionSystem = require('./CollisionSystem');
const AreaEffectManager = require('./AreaEffectManager');

class Lobby {
    constructor(name, hostId) {
        this.id = uuidv4();
        this.name = name;
        this.hostId = hostId;
        this.players = new Map();
        this.maxPlayers = config.maxPlayers;
        this.gameState = "waiting"; // waiting, playing, finished
        this.gameStartTime = null;
        this.gameTimer = null;
        this.gameDuration = config.gameDuration.survival; // Will be adjusted per game mode
        this.gameMode = "survival"; // survival, deathmatch
        // NPC for testing purposes
        this.npc = null;
        this.npcInterval = null;
        this.npcLastTime = null;
        this.npcShootLast = null;
        this.simProjectiles = new Map();
        this.clientPaused = false;

        // Initialize systems
        this.physicsSystem = new PhysicsSystem(this);
        this.projectileSystem = new ProjectileSystem(this);
        this.playerSystem = new PlayerSystem(this);
        this.waveManager = new WaveManager(this);
        this.zombieAI = new ZombieAI(this);
        this.collisionSystem = new CollisionSystem(this);
        this.areaEffectManager = new AreaEffectManager(this);
    }

    addPlayer(playerId, playerName) {
        if (this.players.size >= this.maxPlayers) return false;
        // Duplicate name check (case-insensitive) within lobby
        for (const p of this.players.values()) {
            if (typeof p.name === "string" && typeof playerName === "string") {
                if (p.name.trim().toLowerCase() === playerName.trim().toLowerCase()) {
                    return { error: "Name already taken in this lobby" };
                }
            }
        }

        const player = {
            id: playerId,
            name: playerName,
            x: Math.random() * 600 + 100, // Spawn within 800x600 area (100-700)
            y: Math.random() * 400 + 100, // Spawn within 800x600 area (100-500)
            health: 100,
            score: 0,
            kills: 0,
            deaths: 0,
            lives: 3,
            isDead: false,
            respawnTime: 0,
            lastShot: 0,
            chosenClass: null,
        };

        this.players.set(playerId, player);
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.players.size === 0) {
            this.gameState = "waiting";
            this.gameStartTime = null;
        } else if (this.gameState === "playing" && this.gameMode === "deathmatch") {
            // Check if deathmatch should end when a player leaves during gameplay
            this.playerSystem.checkDeathmatchEnd();
        }
    }

    setGameMode(gameMode) {
        if (["survival", "deathmatch"].includes(gameMode)) {
            this.gameMode = gameMode;
            return true;
        }
        return false;
    }

    startGame() {
        if (this.players.size < 2) return false;
        for (const p of this.players.values()) {
            if (!p.chosenClass) return false;
        }

        this.gameState = "playing";
        this.gameStartTime = Date.now();

        // Set game duration based on game mode
        this.gameDuration = config.gameDuration[this.gameMode];

        // Reset player positions and stats
        this.players.forEach((player, playerId) => {
            player.x = Math.random() * 600 + 100; // Spawn within 800x600 area (100-700)
            player.y = Math.random() * 400 + 100; // Spawn within 800x600 area (100-500)
            player.health = 100;
            player.score = 0;
            player.kills = 0;
            player.deaths = 0;
        });

        // Always initialize walls for collision detection
        this.initializeWalls();

        // Initialize wave-based zombie system only for survival mode
        if (this.gameMode === "survival") {
            this.waveManager.initializeWaves();
        } else {
            // For deathmatch mode, initialize waveManager but don't start waves
            this.waveManager.zombies = new Map(); // Initialize empty zombies map
            this.lastUpdate = Date.now();
            this.waveInterval = setInterval(() => this.updateWaveLoop(), 50);
        }

        // Start game timer
        this.gameTimer = setTimeout(() => {
            this.endGame();
        }, this.gameDuration);

        return true;
    }

    endGame() {
        this.gameState = "finished";
        this.gameStartTime = null;

        // Stop zombie logic only for survival mode
        if (this.gameMode === "survival") {
            this.waveManager.cleanup();
        } else {
            if (this.waveInterval) {
                clearInterval(this.waveInterval);
                this.waveInterval = null;
            }
        }

        // Find winner BEFORE resetting player states
        let winner = null;
        if (this.gameMode === "deathmatch") {
            // For deathmatch: last player standing (alive) or least deaths as tiebreaker
            let alivePlayers = Array.from(this.players.values()).filter(p => !p.isDead);

            if (alivePlayers.length === 1) {
                // Only one player alive - they win
                const player = alivePlayers[0];
                winner = {
                    id: player.id,
                    name: player.name,
                    score: player.score,
                    kills: player.kills,
                    deaths: player.deaths
                };
            } else {
                // Multiple players alive or all dead - use least deaths, then highest score
                let leastDeaths = Infinity;
                let highestScore = -1;

                this.players.forEach((player) => {
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
            }
        } else {
            // For survival mode, use highest score
            let highestScore = -1;
            this.players.forEach((player) => {
                if (player.score > highestScore) {
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
        }

        // Clear other game data
        this.simProjectiles = new Map();
        this.areaEffectManager.clearAllEffects();

        // Reset player states but keep them in lobby
        this.players.forEach((player, playerId) => {
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

        // Emit game end to all players in lobby
        if (this.io) {
            this.io.to(this.id).emit("gameEnd", { winner });
        }

        // Delete lobby after delay (let players see the end screen)
        setTimeout(() => {
            // Notify all players that lobby is being deleted
            if (this.io) {
                this.io.to(this.id).emit("lobbyDeleted", {
                    message: "Lobby has been deleted"
                });
            }

            // Delete the lobby from GameManager
            if (this.gameManager) {
                this.gameManager.removeLobby(this.id);
            }
        }, 10000); // Give players 10 seconds to see the end screen
    }

    // Set the io instance for emitting events
    setIO(io) {
        this.io = io;
    }

    // Set the GameManager reference
    setGameManager(gameManager) {
        this.gameManager = gameManager;
    }

    // Infer weapon key from class name
    inferWeaponKeyFromClass(className) {
        return inferWeaponKeyFromClass(className);
    }

    // Initialize walls for collision detection (used by both game modes)
    initializeWalls() {
        this.worldW = config.worldSize.width;
        this.worldH = config.worldSize.height;
        // Mirror client's interior walls for server-side collision
        const W = this.worldW;
        const H = this.worldH;
        const wallThickness = Math.max(16, Math.floor(Math.min(W, H) * 0.015));
        this.walls = [{
                x: Math.floor(W * 0.18),
                y: Math.floor(H * 0.22),
                w: Math.floor(W * 0.24),
                h: wallThickness,
            },
            {
                x: Math.floor(W * 0.62),
                y: Math.floor(H * 0.38),
                w: wallThickness,
                h: Math.floor(H * 0.26),
            },
            {
                x: Math.floor(W * 0.25),
                y: Math.floor(H * 0.72),
                w: Math.floor(W * 0.3),
                h: wallThickness,
            },
        ];
    }

    updateWaveLoop() {
        if (this.gameMode === "survival") {
            this.waveManager.updateWaveLoop();
        } else {
            // For deathmatch mode, just update area effects and projectiles
            const now = Date.now();
            const dt = Math.max(0.001, (now - (this.lastUpdate || now)) / 1000);
            this.lastUpdate = now;

            this.areaEffectManager.updateAreaEffects(now, dt);
            this.projectileSystem.updateProjectiles(dt);
            this.playerSystem.updatePlayerStates(dt);
        }
    }

    // Player management methods
    updatePlayerPosition(playerId, x, y) {
        this.playerSystem.updatePlayerPosition(playerId, x, y);
    }

    handlePlayerShot(playerId, targetX, targetY, weapon) {
        const shooter = this.players.get(playerId);
        if (!shooter) return;

        // Check for hits on other players and remove projectile after first hit
        this.players.forEach((target, targetId) => {
            if (targetId === playerId) return;

            const distance = Math.sqrt(
                Math.pow(target.x - targetX, 2) + Math.pow(target.y - targetY, 2)
            );

            if (distance <= weapon.projectileSize) {
                // Hit!
                let damage = weapon.damage;
                // Melee damage boost if stored
                if (shooter.chosenClass === "melee" && shooter.meleeCharge) {
                    damage += Math.min(40, shooter.meleeCharge);
                    shooter.meleeCharge = 0;
                }
                // Blocking reduces damage only if facing the attacker
                if (target.isBlocking) {
                    // Require facing within 90 degrees (front arc)
                    const attackAngle = Math.atan2(
                        targetY - target.y,
                        targetX - target.x
                    );
                    const facingAngle = (target.blockAngle || 0) * (Math.PI / 180);
                    let diff = Math.abs(attackAngle - facingAngle);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    const withinFrontArc = diff <= Math.PI / 2;
                    if (withinFrontArc) {
                        const reduced = Math.floor(damage * 0.4); // stronger block (60% reduction)
                        const prevented = damage - reduced;
                        damage = reduced;
                        target.meleeCharge = Math.min(
                            60,
                            (target.meleeCharge || 0) + prevented
                        );
                    }
                }

                target.health = Math.max(0, target.health - damage);
                shooter.score += 5; // Reduced PvP hit points

                // Check for death
                if (target.health <= 0) {
                    this.playerSystem.handlePlayerDeath(targetId);
                    shooter.kills++;
                    shooter.score += 25; // Reduced PvP kill bonus
                }

                // Emit hit effect
                if (this.io) {
                    this.io.to(this.id).emit("playerHit", {
                        targetId,
                        damage,
                        newHealth: target.health,
                        shooterId: playerId,
                        shooterScore: shooter.score,
                    });
                }
            }
        });

        // Check hit on NPC dummy (simple point distance to impact target)
        if (this.npc && typeof this.npc.x === "number") {
            const ndx = this.npc.x - targetX;
            const ndy = this.npc.y - targetY;
            const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
            if (ndist <= weapon.projectileSize + 18) {
                this.npc.health = Math.max(0, this.npc.health - weapon.damage);
                if (this.npc.health <= 0) {
                    this.playerSystem.respawnNPC();
                } else {
                    if (this.io) {
                        this.io.to(this.id).emit("npcState", { npc: this.npc });
                    }
                }
            }
        }
    }

    // Simulate a projectile traveling from shooter to target with weapon stats
    spawnSimulatedProjectile(ownerId, startX, startY, targetX, targetY, weapon) {
        this.projectileSystem.spawnSimulatedProjectile(ownerId, startX, startY, targetX, targetY, weapon);
    }

    // Delegate area effects to the area effect manager
    updateAreaEffects(now, dt) {
        this.areaEffectManager.updateAreaEffects(now, dt);
    }

    // Delegate collision detection to the collision system
    isPositionInWall(x, y) {
        return this.collisionSystem.isPositionInWall(x, y);
    }

    hasLineOfSight(x1, y1, x2, y2) {
        return this.collisionSystem.hasLineOfSight(x1, y1, x2, y2);
    }

    checkProjectileWallCollision(projectile, oldX, oldY) {
        return this.collisionSystem.checkProjectileWallCollision(projectile, oldX, oldY);
    }

    lineIntersectsRect(x1, y1, x2, y2, rect) {
        return this.collisionSystem.lineIntersectsRect(x1, y1, x2, y2, rect);
    }

    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        return this.collisionSystem.linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4);
    }

    // Delegate zombie AI to the zombie AI system
    updateRegularZombie(z, nearest, nx, ny, dist, now, slowFactor, dt) {
        this.zombieAI.updateRegularZombie(z, nearest, nx, ny, dist, now, slowFactor, dt);
    }

    updateFastMob(z, nearest, nx, ny, dist, now, slowFactor, dt) {
        this.zombieAI.updateFastMob(z, nearest, nx, ny, dist, now, slowFactor, dt);
    }

    updateBossMob(z, nearest, nx, ny, dist, now, slowFactor, dt) {
        this.zombieAI.updateBossMob(z, nearest, nx, ny, dist, now, slowFactor, dt);
    }

    // Delegate wall collision resolution to the collision system
    resolveZombieWallCollisions(zombie, oldX, oldY, nearest) {
        this.collisionSystem.resolveZombieWallCollisions(zombie, oldX, oldY, nearest);
    }

    // Delegate wall following movement to the zombie AI system
    updateWallFollowingMovement(zombie, nearest, nx, ny, slowFactor) {
        return this.zombieAI.updateWallFollowingMovement(zombie, nearest, nx, ny, slowFactor);
    }

    applyWallFollowingMovement(zombie, nearest, nx, ny, slowFactor, blendFactor) {
        this.zombieAI.applyWallFollowingMovement(zombie, nearest, nx, ny, slowFactor, blendFactor);
    }

    // Delegate boss abilities to the zombie AI system
    useBossSpecialAbility(z, nearest, nx, ny, dist) {
        this.zombieAI.useBossSpecialAbility(z, nearest, nx, ny, dist);
    }

    useBossProjectileAttack(z, nearest, nx, ny) {
        this.zombieAI.useBossProjectileAttack(z, nearest, nx, ny);
    }

    applyBossMovement(z, nearest, nx, ny, dist, slowFactor) {
        this.zombieAI.applyBossMovement(z, nearest, nx, ny, dist, slowFactor);
    }
}

module.exports = Lobby;