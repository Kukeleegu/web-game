const { v4: uuidv4 } = require("uuid");

class WaveManager {
    constructor(lobby) {
        this.lobby = lobby;
        this.waveNumber = 0;
        this.zombies = new Map();
        this.waveInProgress = false;
        this.waveInterval = null;
        this.waveCountdownTimeout = null;
        this.currentWaveZombies = 0;
        this.totalWaveZombies = 0;
        this.lastZombieSpawn = 0;
        this.zombieSpawnInterval = 0;
        this.zombieBroadcastAccum = 0;
        this.lastUpdate = 0;
    }

    initializeWaves() {
        this.waveNumber = 0;
        this.zombies = new Map();
        this.waveInProgress = false;

        // Multiple spawn locations around the map edges
        this.spawners = [
            { x: this.lobby.worldW - 80, y: 80 }, // Top-right
            { x: this.lobby.worldW - 80, y: this.lobby.worldH - 80 }, // Bottom-right
            { x: 80, y: 80 }, // Top-left
            { x: 80, y: this.lobby.worldH - 80 }, // Bottom-left
            { x: this.lobby.worldW / 2, y: 80 }, // Top-center
            { x: this.lobby.worldW / 2, y: this.lobby.worldH - 80 } // Bottom-center
        ];

        if (this.waveInterval) clearInterval(this.waveInterval);
        this.lastUpdate = Date.now();
        this.zombieBroadcastAccum = 0;
        this.waveInterval = setInterval(() => this.updateWaveLoop(), 50);
        this.startNextWaveWithCountdown(0);
    }

    startNextWaveWithCountdown(delayMs) {
        const baseDelay = typeof delayMs === "number" ? delayMs : 3000;
        this.waveInProgress = false;
        this.waveNumber += 1;
        if (this.lobby.io) {
            this.lobby.io.to(this.lobby.id).emit("waveOver", {
                nextInMs: baseDelay,
                nextWave: this.waveNumber,
            });
        }
        if (this.waveCountdownTimeout) clearTimeout(this.waveCountdownTimeout);
        this.waveCountdownTimeout = setTimeout(() => {
            this.spawnWave(this.waveNumber);
            this.waveInProgress = true;
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("waveStarted", { wave: this.waveNumber });
            }
        }, baseDelay);
    }

    spawnWave(wave) {
        const totalCount = Math.min(50, 3 + wave * 2);

        // Initialize wave spawning state
        this.currentWaveZombies = 0;
        this.totalWaveZombies = totalCount;
        this.lastZombieSpawn = Date.now();

        // Calculate spawn interval (gets faster with higher waves)
        // Wave 1: 2 seconds, Wave 2: 1.5 seconds, Wave 3+: 1 second minimum
        this.zombieSpawnInterval = Math.max(1000, 2500 - wave * 250);

        console.log(
            `Wave ${wave}: Spawning ${totalCount} zombies over time (${this.zombieSpawnInterval}ms intervals)`
        );
    }

    spawnSingleZombie() {
        const id = `z-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // Randomly select a spawn location
        const spawner = this.spawners[Math.floor(Math.random() * this.spawners.length)];

        // Determine NPC type based on wave and random chance
        let npcType = "zombie"; // Default type

        if (this.waveNumber >= 3) {
            // After wave 3, introduce fast mobs
            if (Math.random() < 0.3) {
                npcType = "fastMob";
            }
        }

        if (this.waveNumber >= 5) {
            // After wave 5, introduce boss mobs (rare)
            if (Math.random() < 0.1) {
                npcType = "bossMob";
            }
        }

        let zombie;

        switch (npcType) {
            case "fastMob":
                zombie = {
                    id,
                    type: "fastMob",
                    x: spawner.x + Math.random() * 30,
                    y: spawner.y + Math.random() * 30,
                    vx: 0,
                    vy: 0,
                    speed: 180 + Math.random() * 60, // 3x speed (was 60 + 20)
                    size: 28, // Smaller
                    health: 80,
                    maxHealth: 80,
                    lastAttack: 0,
                    attackCooldown: 800, // Slightly slower attacks
                    damage: 8, // Lower damage
                    knockback: 780, // 3x normal knockback
                    lastEvasion: 0,
                    evasionCooldown: 2000, // Evade every 2 seconds
                    lastSpecialAttack: 0,
                    specialAttackCooldown: 3000, // Special attack every 3 seconds
                    // Wall-following properties
                    isFollowingWall: false,
                    wallFollowDirection: null,
                    lastWallCollision: 0,
                    initialWallFollowX: 0,
                    initialWallFollowY: 0,
                    wallFollowDistance: 0,
                    wallFollowEndTime: 0,
                    wallFollowStartTime: 0,
                    lastProgressTime: 0,
                    lastProgressDistance: 0,
                    followingWallId: null,
                    collisionWall: null,
                    cornerDetectionDistance: 0
                };
                break;

            case "bossMob":
                zombie = {
                    id,
                    type: "bossMob",
                    x: spawner.x + Math.random() * 30,
                    y: spawner.y + Math.random() * 30,
                    vx: 0,
                    vy: 0,
                    speed: 25 + Math.random() * 10, // Slower but steady
                    size: 60, // Much larger
                    health: 1200, // 3x health (was 400)
                    maxHealth: 1200, // 3x max health (was 400)
                    lastAttack: 0,
                    attackCooldown: 1000, // Slower attacks
                    damage: 25, // Higher damage
                    knockback: 400, // Higher knockback
                    lastSpecialAttack: 0,
                    specialAttackCooldown: 3000, // Special attack every 3 seconds
                    lastProjectileAttack: 0,
                    projectileAttackCooldown: 2000, // Projectile attack every 2 seconds
                    specialAbilities: ["slow", "heal", "ranged", "meleeSlam"], // Available abilities
                    // Wall-following properties
                    isFollowingWall: false,
                    wallFollowDirection: null,
                    lastWallCollision: 0,
                    initialWallFollowX: 0,
                    initialWallFollowY: 0,
                    wallFollowDistance: 0,
                    wallFollowEndTime: 0,
                    wallFollowStartTime: 0,
                    lastProgressTime: 0,
                    lastProgressDistance: 0,
                    followingWallId: null,
                    collisionWall: null,
                    cornerDetectionDistance: 0
                };
                break;

            default: // Regular zombie
                zombie = {
                    id,
                    type: "zombie",
                    x: spawner.x + Math.random() * 30,
                    y: spawner.y + Math.random() * 30,
                    vx: 0,
                    vy: 0,
                    speed: 30 + Math.random() * 10,
                    size: 36,
                    health: 120,
                    maxHealth: 120,
                    lastAttack: 0,
                    attackCooldown: 600, // ms
                    damage: 12,
                    knockback: 260,
                    // Wall-following properties
                    isFollowingWall: false,
                    wallFollowDirection: null,
                    lastWallCollision: 0,
                    initialWallFollowX: 0,
                    initialWallFollowY: 0,
                    wallFollowDistance: 0,
                    wallFollowEndTime: 0,
                    wallFollowStartTime: 0,
                    lastProgressTime: 0,
                    lastProgressDistance: 0,
                    followingWallId: null,
                    collisionWall: null,
                    cornerDetectionDistance: 0
                };
                break;
        }

        this.zombies.set(id, zombie);
        this.currentWaveZombies++;
    }

    updateWaveLoop() {
        const now = Date.now();
        if (this.lobby.clientPaused) {
            this.lastUpdate = now;
            return;
        }

        const dt = Math.max(0.001, (now - (this.lastUpdate || now)) / 1000);
        this.lastUpdate = now;

        // Skip zombie logic for deathmatch mode
        if (this.lobby.gameMode === "deathmatch") {
            // Still update area effects and projectiles for deathmatch
            this.lobby.updateAreaEffects(now, dt);
            this.lobby.projectileSystem.updateProjectiles(dt);
            this.lobby.playerSystem.updatePlayerStates(dt);
            return;
        }

        // Handle gradual zombie spawning during active wave
        if (
            this.waveInProgress &&
            this.currentWaveZombies < this.totalWaveZombies &&
            now - this.lastZombieSpawn >= this.zombieSpawnInterval
        ) {
            this.spawnSingleZombie();
            this.lastZombieSpawn = now;
        }

        // Update area effects
        this.lobby.areaEffectManager.updateAreaEffects(now, dt);

        // Update zombies: seek nearest player
        this.zombies.forEach((z) => {
            let nearest = null;
            let nearestD2 = Infinity;
            this.lobby.players.forEach((p, pid) => {
                const dx = p.x - z.x;
                const dy = p.y - z.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < nearestD2) {
                    nearestD2 = d2;
                    nearest = p;
                }
            });
            if (nearest) {
                const dx = nearest.x - z.x;
                const dy = nearest.y - z.y;
                const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
                const nx = dx / dist;
                const ny = dy / dist;

                // Check if zombie is stunned from knockback
                const isStunned = z.stunnedUntil && typeof z.stunnedUntil === "number" && now < z.stunnedUntil;

                // Apply slow effect if present (more robust check)
                const isSlowed =
                    z.slowUntil && typeof z.slowUntil === "number" && now < z.slowUntil;
                const slowFactor = isSlowed ? 0.2 : 1.0; // More dramatic slow effect

                // Handle different NPC types
                if (z.type === "fastMob") {
                    this.lobby.zombieAI.updateFastMob(z, nearest, nx, ny, dist, now, slowFactor, dt);
                } else if (z.type === "bossMob") {
                    this.lobby.zombieAI.updateBossMob(z, nearest, nx, ny, dist, now, slowFactor, dt);
                } else {
                    // Regular zombie behavior
                    this.lobby.zombieAI.updateRegularZombie(z, nearest, nx, ny, dist, now, slowFactor, dt);
                }
            }
        });

        // Update simulated projectiles
        this.lobby.projectileSystem.updateProjectiles(dt);

        // Broadcast zombies state at 20 FPS for smooth movement (only for survival mode)
        if (this.lobby.gameMode === "survival") {
            this.zombieBroadcastAccum += dt;
            if (this.zombieBroadcastAccum >= 0.05) {
                // 20 FPS for zombie updates
                this.zombieBroadcastAccum = 0;
                if (this.lobby.io) {
                    this.lobby.io.to(this.lobby.id).emit("zombiesState", {
                        zombies: Array.from(this.zombies.values()),
                    });
                }
            }
        }

        // Broadcast player states at 10 FPS for scoreboard updates
        this.lobby.playerSystem.updatePlayerStates(dt);

        // Wave completion check - all zombies spawned AND all zombies eliminated (only for survival mode)
        if (
            this.lobby.gameMode === "survival" &&
            this.waveInProgress &&
            this.zombies.size === 0 &&
            this.currentWaveZombies >= this.totalWaveZombies
        ) {
            this.startNextWaveWithCountdown(3000);
        }
    }

    cleanup() {
        if (this.waveInterval) {
            clearInterval(this.waveInterval);
            this.waveInterval = null;
        }
        if (this.waveCountdownTimeout) {
            clearTimeout(this.waveCountdownTimeout);
            this.waveCountdownTimeout = null;
        }
        // Clear zombie data
        this.zombies = new Map();
    }
}

module.exports = WaveManager;