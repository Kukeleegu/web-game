// Zombie and wave management for Lobby class
class ZombieManager {
    constructor(lobby) {
        this.lobby = lobby;
    }

    initializeWaves() {
        this.lobby.waveNumber = 0;
        this.lobby.zombies = new Map();
        this.lobby.waveInProgress = false;

        // Multiple spawn locations around the map edges
        this.lobby.spawners = [
            { x: this.lobby.worldW - 80, y: 80 }, // Top-right
            { x: this.lobby.worldW - 80, y: this.lobby.worldH - 80 }, // Bottom-right
            { x: 80, y: 80 }, // Top-left
            { x: 80, y: this.lobby.worldH - 80 }, // Bottom-left
            { x: this.lobby.worldW / 2, y: 80 }, // Top-center
            { x: this.lobby.worldW / 2, y: this.lobby.worldH - 80 } // Bottom-center
        ];

        if (this.lobby.waveInterval) clearInterval(this.lobby.waveInterval);
        this.lobby.lastUpdate = Date.now();
        this.lobby.zombieBroadcastAccum = 0;
        this.lobby.waveInterval = setInterval(() => this.lobby.updateWaveLoop(), 50);
        this.startNextWaveWithCountdown(0);
    }

    startNextWaveWithCountdown(delayMs) {
        const baseDelay = typeof delayMs === "number" ? delayMs : 3000;
        this.lobby.waveInProgress = false;
        this.lobby.waveNumber += 1;
        if (this.lobby.io) {
            this.lobby.io.to(this.lobby.id).emit("waveOver", {
                nextInMs: baseDelay,
                nextWave: this.lobby.waveNumber,
            });
        }
        if (this.lobby.waveCountdownTimeout) clearTimeout(this.lobby.waveCountdownTimeout);
        this.lobby.waveCountdownTimeout = setTimeout(() => {
            this.spawnWave(this.lobby.waveNumber);
            this.lobby.waveInProgress = true;
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("waveStarted", { wave: this.lobby.waveNumber });
            }
        }, baseDelay);
    }

    spawnWave(wave) {
        const totalCount = Math.min(50, 3 + wave * 2);

        // Initialize wave spawning state
        this.lobby.currentWaveZombies = 0;
        this.lobby.totalWaveZombies = totalCount;
        this.lobby.lastZombieSpawn = Date.now();

        // Calculate spawn interval (gets faster with higher waves)
        this.lobby.zombieSpawnInterval = Math.max(1000, 2500 - wave * 250);

        console.log(
            `Wave ${wave}: Spawning ${totalCount} zombies over time (${this.lobby.zombieSpawnInterval}ms intervals)`
        );
    }

    spawnSingleZombie() {
        const id = `z-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const spawner = this.lobby.spawners[Math.floor(Math.random() * this.lobby.spawners.length)];

        // Determine NPC type based on wave and random chance
        let npcType = "zombie";
        if (this.lobby.waveNumber >= 3 && Math.random() < 0.3) {
            npcType = "fastMob";
        }
        if (this.lobby.waveNumber >= 5 && Math.random() < 0.1) {
            npcType = "bossMob";
        }

        let zombie = this.createZombieByType(id, spawner, npcType);
        this.lobby.zombies.set(id, zombie);
        this.lobby.currentWaveZombies++;
    }

    createZombieByType(id, spawner, npcType) {
        const baseZombie = {
            id,
            type: npcType,
            x: spawner.x + Math.random() * 30,
            y: spawner.y + Math.random() * 30,
            vx: 0,
            vy: 0,
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

        switch (npcType) {
            case "fastMob":
                return {
                    ...baseZombie,
                    speed: 180 + Math.random() * 60,
                    size: 28,
                    health: 80,
                    maxHealth: 80,
                    lastAttack: 0,
                    attackCooldown: 800,
                    damage: 8,
                    knockback: 780,
                    lastEvasion: 0,
                    evasionCooldown: 2000,
                    lastSpecialAttack: 0,
                    specialAttackCooldown: 3000
                };

            case "bossMob":
                return {
                    ...baseZombie,
                    speed: 25 + Math.random() * 10,
                    size: 60,
                    health: 1200,
                    maxHealth: 1200,
                    lastAttack: 0,
                    attackCooldown: 1000,
                    damage: 25,
                    knockback: 400,
                    lastSpecialAttack: 0,
                    specialAttackCooldown: 3000,
                    lastProjectileAttack: 0,
                    projectileAttackCooldown: 2000,
                    specialAbilities: ["slow", "heal", "ranged", "meleeSlam"]
                };

            default: // Regular zombie
                return {
                    ...baseZombie,
                    speed: 30 + Math.random() * 10,
                    size: 36,
                    health: 120,
                    maxHealth: 120,
                    lastAttack: 0,
                    attackCooldown: 600,
                    damage: 12,
                    knockback: 260
                };
        }
    }
}

module.exports = ZombieManager;