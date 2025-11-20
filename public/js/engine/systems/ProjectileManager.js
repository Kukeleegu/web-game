// Projectile Management System
class ProjectileManager {
    constructor(projectiles, walls, physics, addEffect, zombies) {
        this.projectiles = projectiles;
        this.walls = walls;
        this.physics = physics;
        this.addEffect = addEffect;
        this.zombies = zombies;
    }

    addProjectile(projectileData) {
        // Check if projectile starts inside a wall
        if (this.physics.isPositionInWall(projectileData.x, projectileData.y, this.walls)) {
            return; // Don't add projectile if it starts inside a wall
        }

        this.projectiles.set(projectileData.id, projectileData);
    }

    updateProjectiles(deltaTime) {
        const expiredProjectiles = [];

        this.projectiles.forEach((projectile, id) => {
            // Store old position for collision detection
            const oldX = projectile.x;
            const oldY = projectile.y;

            // Move projectile
            projectile.x += projectile.vx * deltaTime;
            projectile.y += projectile.vy * deltaTime;
            projectile.lifetime -= deltaTime;

            // Basic trail update - only for fast projectiles and less frequently
            if (projectile.trail && (projectile.vx * projectile.vx + projectile.vy * projectile.vy) > 200) {
                if (!projectile._lastTrailPoint) projectile._lastTrailPoint = 0;
                const now = performance.now();
                if (now - projectile._lastTrailPoint > 50) { // Add point every 50ms
                    projectile._lastTrailPoint = now;
                    projectile.trailPoints = projectile.trailPoints || [];
                    projectile.trailPoints.push({ x: projectile.x, y: projectile.y });
                    if (projectile.trailPoints.length > (projectile.trailLength || 6)) { // Even shorter trails
                        projectile.trailPoints.shift();
                    }
                }
            }

            // Only check collisions every few frames to reduce performance impact
            if (!projectile._lastCollisionCheck) projectile._lastCollisionCheck = 0;
            const now = performance.now();
            const shouldCheckCollision = now - projectile._lastCollisionCheck > 33; // Check every 33ms (30 FPS)

            if (shouldCheckCollision) {
                projectile._lastCollisionCheck = now;

                // Enhanced wall collision: check line intersection for more accuracy
                let hitWall = false;
                for (const wall of this.walls) {
                    if (
                        this.physics.lineIntersectsRect(oldX, oldY, projectile.x, projectile.y, wall)
                    ) {
                        hitWall = true;
                        // Create wall hit effect
                        this.addEffect({
                            id: `wallHit-${Date.now()}-${id}`,
                            x: oldX,
                            y: oldY,
                            type: "wallHit", // Special type for wall hits
                            radius: 20,
                            lifetime: 0.3,
                            maxLifetime: 0.3,
                        });
                        break;
                    }
                }

                // Client-side zombie collision detection for immediate visual feedback
                let hitZombie = false;
                if (this.zombies && this.zombies.size > 0) {
                    for (const [zombieId, zombie] of this.zombies) {
                        const dx = zombie.x - projectile.x;
                        const dy = zombie.y - projectile.y;
                        const hitRadius = (projectile.size || 10) + (zombie.size || 36) * 0.6;

                        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                            hitZombie = true;
                            // No visual effect - just remove the projectile
                            break;
                        }
                    }
                }

                // Expire projectiles that hit walls, zombies, or expired naturally
                if (hitWall || hitZombie || projectile.lifetime <= 0) {
                    expiredProjectiles.push(id);
                }
            } else if (projectile.lifetime <= 0) {
                // Still check for natural expiration every frame
                expiredProjectiles.push(id);
            }
        });

        expiredProjectiles.forEach((id) => {
            this.projectiles.delete(id);
        });
    }

    // Update references when GameEngine properties change
    updateReferences(projectiles, walls, physics, addEffect, zombies) {
        this.projectiles = projectiles;
        this.walls = walls;
        this.physics = physics;
        this.addEffect = addEffect;
        this.zombies = zombies;
    }
}

// Make ProjectileManager available globally
// @ts-ignore
window.ProjectileManager = ProjectileManager;