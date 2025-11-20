class CollisionSystem {
    constructor(lobby) {
        this.lobby = lobby;
    }

    resolveZombieWallCollisions(zombie, oldX, oldY, nearest) {
        const half = (zombie.size || 36) / 2;
        const zombieRect = {
            x: zombie.x - half,
            y: zombie.y - half,
            w: zombie.size || 36,
            h: zombie.size || 36,
        };

        let collisionDetected = false;
        let slideDirection = { x: 0, y: 0 };

        for (const wall of this.lobby.walls) {
            if (
                zombieRect.x < wall.x + wall.w &&
                zombieRect.x + zombieRect.w > wall.x &&
                zombieRect.y < wall.y + wall.h &&
                zombieRect.y + zombieRect.h > wall.y
            ) {
                collisionDetected = true;

                // Calculate collision normal and slide direction
                const centerX = zombie.x;
                const centerY = zombie.y;
                const wallCenterX = wall.x + wall.w / 2;
                const wallCenterY = wall.y + wall.h / 2;

                // Determine which side of the wall we're colliding with
                const dx = centerX - wallCenterX;
                const dy = centerY - wallCenterY;

                // Calculate overlap on each axis
                const overlapX = Math.min(
                    Math.abs(centerX - (wall.x + wall.w)),
                    Math.abs(centerX - wall.x)
                );
                const overlapY = Math.min(
                    Math.abs(centerY - (wall.y + wall.h)),
                    Math.abs(centerY - wall.y)
                );

                // Push out in the direction of least overlap
                if (overlapX < overlapY) {
                    // Horizontal collision - slide vertically
                    if (dx > 0) {
                        zombie.x = wall.x + wall.w + half;
                        slideDirection.x = 0;
                        slideDirection.y = zombie.vy > 0 ? 1 : -1;
                    } else {
                        zombie.x = wall.x - half;
                        slideDirection.x = 0;
                        slideDirection.y = zombie.vy > 0 ? 1 : -1;
                    }
                } else {
                    // Vertical collision - slide horizontally
                    if (dy > 0) {
                        zombie.y = wall.y + wall.h + half;
                        slideDirection.x = zombie.vx > 0 ? 1 : -1;
                        slideDirection.y = 0;
                    } else {
                        zombie.y = wall.y - half;
                        slideDirection.x = zombie.vx > 0 ? 1 : -1;
                        slideDirection.y = 0;
                    }
                }

                // Start wall-following behavior
                zombie.isFollowingWall = true;
                zombie.lastWallCollision = Date.now();
                zombie.initialWallFollowX = zombie.x;
                zombie.initialWallFollowY = zombie.y;
                zombie.wallFollowDistance = 0;
                zombie.wallFollowStartTime = Date.now();
                zombie.followingWallId = wall.id || `wall_${wall.x}_${wall.y}`;

                // Determine which direction to follow the wall
                if (overlapX < overlapY) {
                    // Horizontal collision - follow wall vertically
                    const zombieToPlayerY = nearest.y - zombie.y;
                    const zombieToPlayerX = nearest.x - zombie.x;

                    if (Math.abs(zombieToPlayerX) > 30) {
                        if (zombieToPlayerX > 0) {
                            zombie.wallFollowDirection = zombie.x > wall.x + wall.w / 2 ? 'up' : 'down';
                        } else {
                            zombie.wallFollowDirection = zombie.x < wall.x + wall.w / 2 ? 'up' : 'down';
                        }
                    } else {
                        zombie.wallFollowDirection = zombie.vy > 0 ? 'down' : 'up';
                    }
                } else {
                    // Vertical collision - follow wall horizontally
                    const zombieToPlayerX = nearest.x - zombie.x;
                    const zombieToPlayerY = nearest.y - zombie.y;

                    if (Math.abs(zombieToPlayerY) > 30) {
                        if (zombieToPlayerY > 0) {
                            zombie.wallFollowDirection = zombie.y > wall.y + wall.h / 2 ? 'left' : 'right';
                        } else {
                            zombie.wallFollowDirection = zombie.y < wall.y + wall.h / 2 ? 'left' : 'right';
                        }
                    } else {
                        zombie.wallFollowDirection = zombie.vx > 0 ? 'right' : 'left';
                    }
                }

                // Store the initial collision wall for better corner detection
                zombie.collisionWall = { x: wall.x, y: wall.y, w: wall.w, h: wall.h };
                zombie.cornerDetectionDistance = 25;

                // Apply smooth sliding movement
                const currentSpeed = Math.sqrt(zombie.vx * zombie.vx + zombie.vy * zombie.vy);
                const slideSpeed = currentSpeed * 0.3;
                const blendFactor = 0.7;
                if (slideDirection.x !== 0) {
                    zombie.vx = zombie.vx * blendFactor + slideDirection.x * slideSpeed * (1 - blendFactor);
                }
                if (slideDirection.y !== 0) {
                    zombie.vy = zombie.vy * blendFactor + slideDirection.y * slideSpeed * (1 - blendFactor);
                }

                break;
            }
        }

        // Keep zombies in world bounds with sliding behavior
        const worldW = this.lobby.worldW || 1200;
        const worldH = this.lobby.worldH || 800;
        const margin = half;

        if (zombie.x < margin) {
            zombie.x = margin;
            zombie.vx = Math.max(0, zombie.vx);
        }
        if (zombie.x > worldW - margin) {
            zombie.x = worldW - margin;
            zombie.vx = Math.min(0, zombie.vx);
        }
        if (zombie.y < margin) {
            zombie.y = margin;
            zombie.vy = Math.max(0, zombie.vy);
        }
        if (zombie.y > worldH - margin) {
            zombie.y = worldH - margin;
            zombie.vy = Math.min(0, zombie.vy);
        }
    }

    // Check if a position is inside any wall
    isPositionInWall(x, y) {
        for (const wall of this.lobby.walls) {
            if (x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h) {
                return true;
            }
        }
        return false;
    }

    // Check line-of-sight between two points
    hasLineOfSight(x1, y1, x2, y2) {
        for (const wall of this.lobby.walls) {
            if (this.lineIntersectsRect(x1, y1, x2, y2, wall)) {
                return false;
            }
        }
        return true;
    }

    // Check if a projectile collides with any wall
    checkProjectileWallCollision(projectile, oldX, oldY) {
        for (const wall of this.lobby.walls) {
            if (this.lineIntersectsRect(oldX, oldY, projectile.x, projectile.y, wall)) {
                return true;
            }
        }
        return false;
    }

    // Helper method to check if a line intersects with a rectangle
    lineIntersectsRect(x1, y1, x2, y2, rect) {
        // Check if any of the line endpoints are inside the rectangle
        if ((x1 >= rect.x && x1 <= rect.x + rect.w && y1 >= rect.y && y1 <= rect.y + rect.h) ||
            (x2 >= rect.x && x2 <= rect.x + rect.w && y2 >= rect.y && y2 <= rect.y + rect.h)) {
            return true;
        }

        // Check if the line intersects any of the rectangle's edges
        return this.linesIntersect(x1, y1, x2, y2, rect.x, rect.y, rect.x + rect.w, rect.y) ||
            this.linesIntersect(x1, y1, x2, y2, rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h) ||
            this.linesIntersect(x1, y1, x2, y2, rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h) ||
            this.linesIntersect(x1, y1, x2, y2, rect.x, rect.y + rect.h, rect.x, rect.y);
    }

    // Helper method to check if two line segments intersect
    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return false; // Lines are parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }
}

module.exports = CollisionSystem;