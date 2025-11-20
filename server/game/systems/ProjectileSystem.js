// Projectile management and physics
class ProjectileSystem {
    constructor(lobby) {
        this.lobby = lobby;
    }

    // Update projectiles and handle collisions
    updateProjectiles(dt) {
        if (!this.lobby.simProjectiles) this.lobby.simProjectiles = new Map();
        const toDelete = [];

        this.lobby.simProjectiles.forEach((p, pid) => {
            // Store old position for collision rollback
            const oldX = p.x;
            const oldY = p.y;

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.ttl -= dt;

            if (p.ttl <= 0) {
                toDelete.push(pid);
                return;
            }
            if (p.x < -50 || p.x > 1250 || p.y < -50 || p.y > 850) {
                toDelete.push(pid);
                return;
            }

            // Check wall collisions
            if (this.lobby.physicsSystem.checkProjectileWallCollision(p, oldX, oldY)) {
                if (this.lobby.io) {
                    this.lobby.io.to(this.lobby.id).emit("projectileWallHit", {
                        x: oldX,
                        y: oldY,
                        projectileId: pid,
                        ownerId: p.ownerId,
                    });
                }
                toDelete.push(pid);
                return;
            }

            // Check player hits
            this.checkPlayerHits(p, pid, toDelete);

            // Check zombie hits (only in survival mode)
            if (this.lobby.gameMode === "survival") {
                this.checkZombieHits(p, pid, toDelete);
            }
        });

        // Clean up deleted projectiles
        toDelete.forEach((pid) => {
            this.lobby.simProjectiles.delete(pid);
        });
    }

    checkPlayerHits(projectile, pid, toDelete) {
        // Hit players (always check for boss projectiles, or in deathmatch mode for player projectiles)
        if (projectile.ownerType === "bossMob" || this.lobby.gameMode === "deathmatch") {
            this.lobby.players.forEach((tgt, tid) => {
                if (toDelete.includes(pid)) return;
                if (projectile.ownerId === tid) return;

                // For penetrating arrows, check if we've already hit this target
                if (projectile.penetrating && projectile.hitTargets && projectile.hitTargets.has(`player-${tid}`))
                    return;

                const dx = tgt.x - projectile.x;
                const dy = tgt.y - projectile.y;
                const r = (projectile.size || 10) + 20;
                if (dx * dx + dy * dy <= r * r) {
                    tgt.health = Math.max(0, tgt.health - projectile.damage);

                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("playerHit", {
                            shooterId: projectile.ownerId,
                            targetId: tid,
                            newHealth: tgt.health,
                            damage: projectile.damage,
                            hitX: projectile.x,
                            hitY: projectile.y,
                        });
                    }

                    // Check for death
                    if (tgt.health <= 0) {
                        this.lobby.playerSystem.handlePlayerDeath(tid);
                    }

                    // For penetrating arrows, mark this target as hit instead of deleting projectile
                    if (projectile.penetrating && projectile.hitTargets) {
                        projectile.hitTargets.add(`player-${tid}`);
                    } else {
                        toDelete.push(pid);
                    }
                }
            });
        }
    }

    checkZombieHits(projectile, pid, toDelete) {
        if (!this.lobby.waveManager || !this.lobby.waveManager.zombies) return;
        this.lobby.waveManager.zombies.forEach((z, zid) => {
            if (toDelete.includes(pid)) return;

            // For penetrating arrows, check if we've already hit this target
            if (projectile.penetrating && projectile.hitTargets && projectile.hitTargets.has(`zombie-${zid}`))
                return;

            // Prevent boss mobs from hitting themselves with their own projectiles
            if (projectile.ownerId === zid) return;

            // Prevent boss mobs from hitting other zombies (friendly fire)
            if (projectile.ownerType === "bossMob" && z.type === "bossMob") return;

            const dx = z.x - projectile.x;
            const dy = z.y - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const hitRadius = (projectile.size || 10) + (z.size || 36) * 0.6;

            if (distance <= hitRadius) {

                // Apply damage to zombie
                z.health = Math.max(0, z.health - projectile.damage);
                const shooter = this.lobby.players.get(projectile.ownerId);

                // Award points for hitting zombie
                if (shooter) {
                    const hitPoints = projectile.penetrating ? 4 : 2;
                    shooter.score = (shooter.score || 0) + hitPoints;
                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("scoreUpdate", {
                            playerId: projectile.ownerId,
                            newScore: shooter.score,
                        });
                    }
                }

                // If zombie dies, award bonus points and remove it
                if (z.health <= 0) {
                    this.lobby.waveManager.zombies.delete(zid);
                    if (shooter) {
                        const killBonus = projectile.penetrating ? 20 : 10;
                        shooter.score = (shooter.score || 0) + killBonus;
                        if (this.lobby.io) {
                            this.lobby.io.to(this.lobby.id).emit("scoreUpdate", {
                                playerId: projectile.ownerId,
                                newScore: shooter.score,
                            });
                        }
                    }
                }

                // For penetrating arrows, mark this target as hit instead of deleting projectile
                if (projectile.penetrating && projectile.hitTargets) {
                    projectile.hitTargets.add(`zombie-${zid}`);
                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("projectileHit", {
                            shooterId: projectile.ownerId,
                            hitX: projectile.x,
                            hitY: projectile.y,
                            penetrating: true,
                        });
                    }
                } else {
                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("projectileHit", {
                            shooterId: projectile.ownerId,
                            hitX: projectile.x,
                            hitY: projectile.y,
                        });
                    }
                    toDelete.push(pid);
                }
            }
        });
    }

    // Simulate a projectile traveling from shooter to target with weapon stats
    spawnSimulatedProjectile(ownerId, startX, startY, targetX, targetY, weapon) {
        const angle = Math.atan2(targetY - startY, targetX - startX);
        const vx = Math.cos(angle) * weapon.projectileSpeed;
        const vy = Math.sin(angle) * weapon.projectileSpeed;
        const id = `p-${ownerId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const ttl = Number(weapon.projectileLifetime) || 2.0;

        // Check if starting position is inside a wall
        if (this.lobby.physicsSystem.isPositionInWall(startX, startY)) {
            return;
        }

        this.lobby.simProjectiles = this.lobby.simProjectiles || new Map();
        const projectile = {
            x: startX,
            y: startY,
            vx,
            vy,
            size: Number(weapon.projectileSize) || 10,
            damage: Number(weapon.damage) || 10,
            ttl,
            ownerId,
            projectileId: id,
            isNpc: false,
        };

        this.lobby.simProjectiles.set(id, projectile);


    }
}

module.exports = ProjectileSystem;