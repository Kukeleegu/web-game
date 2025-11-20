class ZombieAI {
    constructor(lobby) {
        this.lobby = lobby;
    }

    updateRegularZombie(z, nearest, nx, ny, dist, now, slowFactor, dt) {
        // Check if zombie is stunned from knockback
        const isStunned = z.stunnedUntil && typeof z.stunnedUntil === "number" && now < z.stunnedUntil;

        // If stunned, don't move towards player, just apply knockback physics
        if (isStunned) {
            // Apply knockback physics (gravity-like effect to slow down)
            z.vx *= 0.95; // Gradually reduce knockback velocity
            z.vy *= 0.95;
        } else {
            // Try wall-following first if we're stuck
            if (z.isFollowingWall) {
                const stillFollowing = this.updateWallFollowingMovement(z, nearest, nx, ny, slowFactor);
                if (stillFollowing) {
                    // Still wall-following, skip normal movement
                } else {
                    // Wall-following ended, add a small delay before normal movement
                    // This prevents sudden direction changes that can make zombies appear to move away
                    const wallFollowEndDelay = 200; // 200ms delay
                    if (now - (z.wallFollowEndTime || 0) < wallFollowEndDelay) {
                        // Still in delay period, gradually transition to normal movement
                        const transitionProgress = (now - (z.wallFollowEndTime || 0)) / wallFollowEndDelay;
                        const currentSpeed = z.speed * slowFactor * transitionProgress;
                        z.vx = nx * currentSpeed;
                        z.vy = ny * currentSpeed;
                    } else {
                        // Delay period ended, use normal movement
                        z.vx = nx * z.speed * slowFactor;
                        z.vy = ny * z.speed * slowFactor;
                    }
                }
            } else {
                // Normal movement towards player
                z.vx = nx * z.speed * slowFactor;
                z.vy = ny * z.speed * slowFactor;
            }
        }

        // Store old position for collision rollback
        const oldX = z.x;
        const oldY = z.y;

        // Update position
        z.x += z.vx * dt;
        z.y += z.vy * dt;

        // Check wall collisions and resolve
        this.lobby.collisionSystem.resolveZombieWallCollisions(z, oldX, oldY, nearest);

        // Melee hit when close
        const meleeRange = (z.size || 36) * 0.7 + 20;
        if (dist <= meleeRange && now - (z.lastAttack || 0) >= z.attackCooldown) {
            z.lastAttack = now;
            // Apply knockback + damage
            const kx = nx * z.knockback;
            const ky = ny * z.knockback;
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("applyKnockback", {
                    playerId: nearest.id || nearest,
                    vx: kx,
                    vy: ky,
                });
            }
            nearest.health = Math.max(0, nearest.health - z.damage);
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("playerHit", {
                    shooterId: "zombie",
                    targetId: nearest.id || nearest,
                    newHealth: nearest.health,
                    damage: z.damage,
                });
            }

            // Check for death
            if (nearest.health <= 0) {
                this.lobby.playerSystem.handlePlayerDeath(nearest.id || nearest);
            }
        }
    }

    updateFastMob(z, nearest, nx, ny, dist, now, slowFactor, dt) {
        // Fast mob behavior: move towards player but try to evade attacks
        const isStunned = z.stunnedUntil && typeof z.stunnedUntil === "number" && now < z.stunnedUntil;

        if (isStunned) {
            // Apply knockback physics
            z.vx *= 0.95;
            z.vy *= 0.95;
        } else {
            // Check for wall-following first if we're stuck
            if (z.isFollowingWall) {
                const stillFollowing = this.updateWallFollowingMovement(z, nearest, nx, ny, slowFactor);
                if (stillFollowing) {
                    // Still wall-following, skip normal movement
                } else {
                    // Wall-following ended, add a small delay before normal movement
                    // This prevents sudden direction changes that can make zombies appear to move away
                    const wallFollowEndDelay = 200; // 200ms delay
                    if (now - (z.wallFollowEndTime || 0) < wallFollowEndDelay) {
                        // Still in delay period, gradually transition to normal movement
                        const transitionProgress = (now - (z.wallFollowEndTime || 0)) / wallFollowEndDelay;
                        const currentSpeed = z.speed * slowFactor * transitionProgress;
                        z.vx = nx * currentSpeed;
                        z.vy = ny * currentSpeed;
                        return; // Skip the rest of the movement logic during transition
                    }
                    // Delay period ended, use normal fast mob logic
                    this.handleFastMobMovement(z, nearest, nx, ny, slowFactor, now);
                }
            } else {
                // Normal fast mob behavior (no wall-following)
                this.handleFastMobMovement(z, nearest, nx, ny, slowFactor, now);
            }
        }

        // Store old position for collision rollback
        const oldX = z.x;
        const oldY = z.y;

        // Update position
        z.x += z.vx * dt;
        z.y += z.vy * dt;

        // Check wall collisions and resolve
        this.lobby.collisionSystem.resolveZombieWallCollisions(z, oldX, oldY, nearest);

        // Melee hit when close
        const meleeRange = (z.size || 36) * 0.7 + 20;
        if (dist <= meleeRange && now - (z.lastAttack || 0) >= z.attackCooldown) {
            z.lastAttack = now;
            // Apply knockback + damage
            const kx = nx * z.knockback;
            const ky = ny * z.knockback;
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("applyKnockback", {
                    playerId: nearest.id || nearest,
                    vx: kx,
                    vy: ky,
                });
            }
            nearest.health = Math.max(0, nearest.health - z.damage);
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("playerHit", {
                    shooterId: "zombie",
                    targetId: nearest.id || nearest,
                    newHealth: nearest.health,
                    damage: z.damage,
                });
            }

            // Check for death
            if (nearest.health <= 0) {
                this.lobby.playerSystem.handlePlayerDeath(nearest.id || nearest);
            }
        }
    }

    handleFastMobMovement(z, nearest, nx, ny, slowFactor, now) {
        // Check for nearby projectiles to dodge
        let shouldDodge = false;
        let dodgeDirection = { x: 0, y: 0 };

        if (this.lobby.simProjectiles) {
            this.lobby.simProjectiles.forEach((projectile) => {
                if (projectile.ownerId !== z.id) { // Don't dodge own projectiles
                    const dx = projectile.x - z.x;
                    const dy = projectile.y - z.y;
                    const projectileDist = Math.sqrt(dx * dx + dy * dy);

                    // Dodge if projectile is within 100 pixels and heading towards us
                    if (projectileDist < 100) {
                        const projSpeed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);
                        if (projSpeed > 0) {
                            const projDirX = projectile.vx / projSpeed;
                            const projDirY = projectile.vy / projSpeed;

                            // Calculate if projectile is heading towards zombie
                            const dotProduct = dx * projDirX + dy * projDirY;
                            if (dotProduct > 0) { // Projectile heading towards zombie
                                shouldDodge = true;
                                // Dodge perpendicular to projectile direction
                                dodgeDirection.x = -projDirY;
                                dodgeDirection.y = projDirX;
                            }
                        }
                    }
                }
            });
        }

        if (shouldDodge) {
            // Emergency dodge - move perpendicular to projectile direction
            const dodgeSpeed = z.speed * 1.6 * slowFactor; // Faster dodge
            z.vx = dodgeDirection.x * dodgeSpeed;
            z.vy = dodgeDirection.y * dodgeSpeed;
            z.lastEvasion = now; // Reset evasion timer
        } else {
            // Enhanced evasion system with weaving and dodging
            const timeSinceEvasion = now - (z.lastEvasion || 0);
            const evasionPhase = (timeSinceEvasion % 1000) / 1000; // 0 to 1 over 1 second

            if (timeSinceEvasion >= z.evasionCooldown) {
                // Major evasion - move perpendicular to player direction
                const evadeX = -ny * z.speed * 0.8 * slowFactor;
                const evadeY = nx * z.speed * 0.8 * slowFactor;
                z.vx = evadeX;
                z.vy = evadeY;
                z.lastEvasion = now;
            } else if (timeSinceEvasion >= 200) { // Start weaving after 200ms
                // Weaving pattern: sine wave perpendicular to movement direction
                const weaveIntensity = 1.2 * slowFactor; // Moderate weaving
                const weaveFrequency = 4; // Moderate weaving speed

                // Base movement towards player
                const baseSpeed = z.speed * 0.7 * slowFactor;
                const baseVx = nx * baseSpeed;
                const baseVy = ny * baseSpeed;

                // Add weaving motion perpendicular to player direction
                const weaveX = -ny * baseSpeed * weaveIntensity * Math.sin(evasionPhase * weaveFrequency * Math.PI * 2);
                const weaveY = nx * baseSpeed * weaveIntensity * Math.sin(evasionPhase * weaveFrequency * Math.PI * 2);

                z.vx = baseVx + weaveX;
                z.vy = baseVy + weaveY;
            } else {
                // Initial approach - move directly towards player
                z.vx = nx * z.speed * slowFactor;
                z.vy = ny * z.speed * slowFactor;
            }
        }
    }

    updateBossMob(z, nearest, nx, ny, dist, now, slowFactor, dt) {
        // Check if boss is stunned
        if (z.stunnedUntil && now < z.stunnedUntil) {
            // Boss is stunned - reduce movement speed significantly
            z.vx *= 0.95;
            z.vy *= 0.95;

            // Boss should still be able to use abilities even when stunned (reduced frequency)
            if (nearest && now - (z.lastSpecialAttack || 0) >= z.specialAttackCooldown * 2) {
                z.lastSpecialAttack = now;
                this.useBossSpecialAbility(z, nearest, nx, ny, dist);
            }
        } else {
            // Check for wall-following first if we're stuck
            if (z.isFollowingWall) {
                const stillFollowing = this.updateWallFollowingMovement(z, nearest, nx, ny, slowFactor);
                if (stillFollowing) {
                    // Still wall-following, skip normal movement
                } else {
                    // Wall-following ended, add a small delay before normal movement
                    const wallFollowEndDelay = 200; // 200ms delay
                    if (now - (z.wallFollowEndTime || 0) < wallFollowEndDelay) {
                        // Still in delay period, gradually transition to normal movement
                        const transitionProgress = (now - (z.wallFollowEndTime || 0)) / wallFollowEndDelay;
                        const currentSpeed = z.speed * slowFactor * transitionProgress;
                        // Use strategic movement but with reduced speed during transition
                        const idealDistance = 200;
                        if (dist < idealDistance - 50) {
                            z.vx = -nx * currentSpeed * 0.5;
                            z.vy = -ny * currentSpeed * 0.5;
                        } else if (dist > idealDistance + 50) {
                            z.vx = nx * currentSpeed * 0.7;
                            z.vy = ny * currentSpeed * 0.7;
                        } else {
                            const strafeX = -ny * currentSpeed * 0.3;
                            const strafeY = nx * currentSpeed * 0.3;
                            z.vx = strafeX;
                            z.vy = strafeY;
                        }
                    } else {
                        // Delay period ended, use normal boss movement
                        this.applyBossMovement(z, nearest, nx, ny, dist, slowFactor);
                    }
                }
            } else {
                // Normal boss movement (no wall-following)
                this.applyBossMovement(z, nearest, nx, ny, dist, slowFactor);
            }
        }

        // Ensure boss has all required properties for abilities
        if (!z.lastSpecialAttack) z.lastSpecialAttack = 0;
        if (!z.lastProjectileAttack) z.lastProjectileAttack = 0;
        if (!z.specialAbilities) z.specialAbilities = ["slow", "heal", "ranged", "meleeSlam"];
        if (!z.specialAttackCooldown) z.specialAttackCooldown = 3000;
        if (!z.projectileAttackCooldown) z.projectileAttackCooldown = 2000;

        // Store old position for collision rollback
        const oldX = z.x;
        const oldY = z.y;

        // Update position
        z.x += z.vx * dt;
        z.y += z.vy * dt;

        // Check wall collisions and resolve
        this.lobby.collisionSystem.resolveZombieWallCollisions(z, oldX, oldY, nearest);

        // Special abilities every 3 seconds
        if (nearest && dist >= 80 && dist <= 600 && now - (z.lastSpecialAttack || 0) >= z.specialAttackCooldown) {
            const tooCloseToPlayer = dist < 60;
            if (!tooCloseToPlayer) {
                z.lastSpecialAttack = now;
                this.useBossSpecialAbility(z, nearest, nx, ny, dist);
            }
        }

        // Projectile attacks every 2 seconds
        if (nearest && dist >= 60 && dist <= 700 && now - (z.lastProjectileAttack || 0) >= z.projectileAttackCooldown) {
            const tooCloseToPlayer = dist < 50;
            if (!tooCloseToPlayer) {
                z.lastProjectileAttack = now;
                this.useBossProjectileAttack(z, nearest, nx, ny);
            }
        }

        // Melee hit when close - use smaller range for boss to prevent self-damage
        const meleeRange = z.type === "bossMob" ? 80 : (z.size || 36) * 0.7 + 20;
        if (dist <= meleeRange && now - (z.lastAttack || 0) >= z.attackCooldown) {
            z.lastAttack = now;
            // Apply knockback + damage
            const kx = nx * z.knockback;
            const ky = ny * z.knockback;
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("applyKnockback", {
                    playerId: nearest.id || nearest,
                    vx: kx,
                    vy: ky,
                });
            }
            nearest.health = Math.max(0, nearest.health - z.damage);
            if (this.lobby.io) {
                this.lobby.io.to(this.lobby.id).emit("playerHit", {
                    shooterId: "bossMob",
                    targetId: nearest.id || nearest,
                    newHealth: nearest.health,
                    damage: z.damage,
                });
            }

            // Check for death
            if (nearest.health <= 0) {
                this.lobby.playerSystem.handlePlayerDeath(nearest.id || nearest);
            }
        }
    }

    applyBossMovement(z, nearest, nx, ny, dist, slowFactor) {
        // Strategic movement: maintain distance for ranged attacks
        const idealDistance = 200; // Prefer to stay at this distance
        if (dist < idealDistance - 50) {
            // Too close, back away
            z.vx = -nx * z.speed * 0.5 * slowFactor;
            z.vy = -ny * z.speed * 0.5 * slowFactor;
        } else if (dist > idealDistance + 50) {
            // Too far, move closer
            z.vx = nx * z.speed * 0.7 * slowFactor;
            z.vy = ny * z.speed * 0.7 * slowFactor;
        } else {
            // At ideal distance, strafe
            const strafeX = -ny * z.speed * 0.3 * slowFactor;
            const strafeY = nx * z.speed * 0.3 * slowFactor;
            z.vx = strafeX;
            z.vy = strafeY;
        }
    }

    useBossSpecialAbility(z, nearest, nx, ny, dist) {
        // Randomly select a special ability
        const ability = z.specialAbilities[Math.floor(Math.random() * z.specialAbilities.length)];

        switch (ability) {
            case "slow":
                // Apply slow effect to player
                nearest.slowUntil = Date.now() + 3000; // 3 seconds
                nearest.slowFactor = 0.3;
                if (this.lobby.io) {
                    this.lobby.io.to(this.lobby.id).emit("playerSlowed", {
                        playerId: nearest.id || nearest,
                        slowFactor: 0.3,
                        duration: 3000
                    });
                }
                break;

            case "heal":
                // Boss heals itself
                const oldHealth = z.health;
                z.health = Math.min(z.maxHealth, z.health + 50);
                break;

            case "ranged":
                // Boss uses ranged attack (similar to penetrating arrow)
                const projectileId = `boss-${z.id}-${Date.now()}`;
                // Spawn projectile outside boss hitbox to prevent self-damage
                const spawnDistance = (z.size || 60) / 2 + 20;
                const projectile = {
                    id: projectileId,
                    x: z.x + nx * spawnDistance,
                    y: z.y + ny * spawnDistance,
                    vx: nx * 600, // Fast projectile
                    vy: ny * 600,
                    size: 15,
                    damage: 30,
                    ttl: 2.0,
                    penetrating: true,
                    hitTargets: new Set(),
                    ownerId: z.id,
                    ownerType: "bossMob"
                };
                this.lobby.simProjectiles.set(projectileId, projectile);

                // Send projectile to clients for visual rendering
                if (this.lobby.io) {
                    this.lobby.io.to(this.lobby.id).emit("projectileCreate", {
                        id: projectileId,
                        x: projectile.x,
                        y: projectile.y,
                        vx: projectile.vx,
                        vy: projectile.vy,
                        size: 15,
                        color: "#ff0000", // Red color for boss projectiles
                        playerId: "bossMob",
                        penetrating: true,
                    });
                }
                break;

            case "meleeSlam":
                // Boss uses melee slam ability
                if (dist <= 150) { // Extended range for slam
                    const kx = nx * 600; // Strong knockback
                    const ky = ny * 600;
                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("applyKnockback", {
                            playerId: nearest.id || nearest,
                            vx: kx,
                            vy: ky,
                        });
                    }
                    nearest.health = Math.max(0, nearest.health - 40); // High damage
                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("playerHit", {
                            shooterId: "bossMob",
                            targetId: nearest.id || nearest,
                            newHealth: nearest.health,
                            damage: 40,
                        });
                    }

                    // Check for death
                    if (nearest.health <= 0) {
                        this.lobby.playerSystem.handlePlayerDeath(nearest.id || nearest);
                    }
                }
                break;
        }
    }

    useBossProjectileAttack(z, nearest, nx, ny) {
        // Boss fires projectile at player
        const projectileId = `boss-proj-${z.id}-${Date.now()}`;
        // Spawn projectile outside boss hitbox to prevent self-damage
        const spawnDistance = (z.size || 60) / 2 + 20;
        const projectile = {
            id: projectileId,
            x: z.x + nx * spawnDistance,
            y: z.y + ny * spawnDistance,
            vx: nx * 500, // Medium speed projectile
            vy: ny * 500,
            size: 12,
            damage: 25,
            ttl: 2.5,
            penetrating: false,
            hitTargets: new Set(),
            ownerId: z.id,
            ownerType: "bossMob"
        };
        this.lobby.simProjectiles.set(projectileId, projectile);

        // Send projectile to clients for visual rendering
        if (this.lobby.io) {
            this.lobby.io.to(this.lobby.id).emit("projectileCreate", {
                id: projectileId,
                x: projectile.x,
                y: projectile.y,
                vx: projectile.vx,
                vy: projectile.vy,
                size: 12,
                color: "#ff4444", // Darker red for regular boss projectiles
                playerId: "bossMob",
                penetrating: false,
            });
        }
    }

    // Wall-following movement logic for zombies
    updateWallFollowingMovement(zombie, nearest, nx, ny, slowFactor) {
        const now = Date.now();
        const wallFollowTimeout = 8000;
        const wallFollowStartDelay = 150;

        // Check if we're still in the start delay period
        if (now - (zombie.wallFollowStartTime || 0) < wallFollowStartDelay) {
            const blendProgress = (now - (zombie.wallFollowStartTime || 0)) / wallFollowStartDelay;
            const wallFollowBlend = blendProgress * 0.9;
            this.applyWallFollowingMovement(zombie, nearest, nx, ny, slowFactor, wallFollowBlend);
        }

        // Safety check: ensure we have a valid wall-following direction
        if (!zombie.wallFollowDirection) {
            zombie.isFollowingWall = false;
            zombie.wallFollowDirection = null;
            zombie.initialWallFollowX = 0;
            zombie.initialWallFollowY = 0;
            zombie.wallFollowDistance = 0;
            zombie.followingWallId = null;
            zombie.collisionWall = null;
            zombie.cornerDetectionDistance = 0;
            return false;
        }

        // Check timeout first
        if (now - zombie.lastWallCollision > wallFollowTimeout) {
            zombie.isFollowingWall = false;
            zombie.wallFollowDirection = null;
            zombie.initialWallFollowX = 0;
            zombie.initialWallFollowY = 0;
            zombie.wallFollowDistance = 0;
            zombie.wallFollowEndTime = now;
            zombie.followingWallId = null;
            zombie.collisionWall = null;
            zombie.cornerDetectionDistance = 0;
            return false;
        }

        // Update progress tracking
        if (zombie.wallFollowDirection === 'left' || zombie.wallFollowDirection === 'right') {
            zombie.wallFollowDistance = Math.abs(zombie.x - zombie.initialWallFollowX);
        } else {
            zombie.wallFollowDistance = Math.abs(zombie.y - zombie.initialWallFollowY);
        }

        // Stuck detection
        const lastProgressTime = zombie.lastProgressTime || zombie.lastWallCollision;
        if (now - lastProgressTime > 5000 && zombie.wallFollowDistance < 20) {
            zombie.isFollowingWall = false;
            zombie.wallFollowDirection = null;
            zombie.initialWallFollowX = 0;
            zombie.initialWallFollowY = 0;
            zombie.wallFollowDistance = 0;
            zombie.wallFollowEndTime = now;
            zombie.followingWallId = null;
            zombie.collisionWall = null;
            zombie.cornerDetectionDistance = 0;
            return false;
        }

        // Update progress time if we're making progress
        if (zombie.wallFollowDistance > (zombie.lastProgressDistance || 0)) {
            zombie.lastProgressTime = now;
            zombie.lastProgressDistance = zombie.wallFollowDistance;
        }

        // Corner detection and smooth navigation
        if (zombie.collisionWall && zombie.wallFollowDistance >= zombie.cornerDetectionDistance) {
            const wall = zombie.collisionWall;
            const half = zombie.radius || 15;

            // Check if we're approaching a corner
            let approachingCorner = false;
            let newDirection = null;

            if (zombie.wallFollowDirection === 'up' || zombie.wallFollowDirection === 'down') {
                // Moving vertically along a horizontal wall
                if (zombie.wallFollowDirection === 'up') {
                    if (Math.abs(zombie.y - wall.y) < 30) {
                        approachingCorner = true;
                        newDirection = zombie.x > wall.x + wall.w / 2 ? 'right' : 'left';
                    }
                } else { // down
                    if (Math.abs(zombie.y - (wall.y + wall.h)) < 30) {
                        approachingCorner = true;
                        newDirection = zombie.x > wall.x + wall.w / 2 ? 'right' : 'left';
                    }
                }
            } else { // left or right
                // Moving horizontally along a vertical wall
                if (zombie.wallFollowDirection === 'left') {
                    if (Math.abs(zombie.x - wall.x) < 30) {
                        approachingCorner = true;
                        newDirection = zombie.y > wall.y + wall.h / 2 ? 'down' : 'up';
                    }
                } else { // right
                    if (Math.abs(zombie.x - (wall.x + wall.w)) < 30) {
                        approachingCorner = true;
                        newDirection = zombie.y > wall.y + wall.h / 2 ? 'down' : 'up';
                    }
                }
            }

            // If approaching a corner, smoothly change direction
            if (approachingCorner && newDirection) {
                zombie.wallFollowDirection = newDirection;
                zombie.initialWallFollowX = zombie.x;
                zombie.initialWallFollowY = zombie.y;
                zombie.wallFollowDistance = 0;
                zombie.cornerDetectionDistance = 35;
            }
        }

        // Check if we can see the player clearly now
        const canSeePlayer = this.lobby.physicsSystem.hasLineOfSight(zombie.x, zombie.y, nearest.x, nearest.y);

        // Only exit if we have a clear line of sight AND we've moved significantly along the wall
        if (canSeePlayer && zombie.wallFollowDistance >= 50) {
            // Check if we've actually cleared the obstacle
            const testDistance = 25;
            const playerDirX = nearest.x > zombie.x ? 1 : nearest.x < zombie.x ? -1 : 0;
            const playerDirY = nearest.y > zombie.y ? 1 : nearest.y < zombie.y ? -1 : 0;

            const testX = zombie.x + playerDirX * testDistance;
            const testY = zombie.y + playerDirY * testDistance;

            let canMoveTowardsPlayer = true;
            for (const wall of this.lobby.walls) {
                const half = zombie.radius || 15;
                if (testX + half > wall.x && testX - half < wall.x + wall.w &&
                    testY + half > wall.y && testY - half < wall.y + wall.h) {
                    canMoveTowardsPlayer = false;
                    break;
                }
            }

            if (canMoveTowardsPlayer) {
                zombie.isFollowingWall = false;
                zombie.wallFollowDirection = null;
                zombie.initialWallFollowX = 0;
                zombie.initialWallFollowY = 0;
                zombie.wallFollowDistance = 0;
                zombie.wallFollowEndTime = 0;
                zombie.followingWallId = null;
                zombie.collisionWall = null;
                zombie.cornerDetectionDistance = 0;
                return false;
            }
        }

        // Wall-following movement - use consistent speed
        const followSpeed = zombie.speed * 0.7 * slowFactor;

        switch (zombie.wallFollowDirection) {
            case 'left':
                zombie.vx = -followSpeed;
                zombie.vy = 0;
                break;
            case 'right':
                zombie.vx = followSpeed;
                zombie.vy = 0;
                break;
            case 'up':
                zombie.vx = 0;
                zombie.vy = -followSpeed;
                break;
            case 'down':
                zombie.vx = 0;
                zombie.vy = followSpeed;
                break;
            default:
                return false;
        }

        return true; // Still wall-following
    }

    // Apply wall-following movement with blending for smooth transitions
    applyWallFollowingMovement(zombie, nearest, nx, ny, slowFactor, blendFactor) {
        const followSpeed = zombie.speed * 0.8 * slowFactor;
        let wallFollowVx = 0;
        let wallFollowVy = 0;

        // Calculate wall-following velocity
        switch (zombie.wallFollowDirection) {
            case 'left':
                wallFollowVx = -followSpeed;
                wallFollowVy = 0;
                break;
            case 'right':
                wallFollowVx = followSpeed;
                wallFollowVy = 0;
                break;
            case 'up':
                wallFollowVx = 0;
                wallFollowVy = -followSpeed;
                break;
            case 'down':
                wallFollowVx = 0;
                wallFollowVy = followSpeed;
                break;
        }

        // Blend wall-following movement with original movement direction
        const originalVx = nx * zombie.speed * slowFactor;
        const originalVy = ny * zombie.speed * slowFactor;

        zombie.vx = originalVx * (1 - blendFactor) + wallFollowVx * blendFactor;
        zombie.vy = originalVy * (1 - blendFactor) + wallFollowVy * blendFactor;
    }
}

module.exports = ZombieAI;