// Physics and collision detection system
class PhysicsSystem {
    constructor(lobby) {
        this.lobby = lobby;
    }

    // Check if a position is inside any wall
    isPositionInWall(x, y) {
        for (const wall of this.lobby.walls) {
            if (
                x >= wall.x &&
                x <= wall.x + wall.w &&
                y >= wall.y &&
                y <= wall.y + wall.h
            ) {
                return true;
            }
        }
        return false;
    }

    // Check if a projectile collides with any wall
    checkProjectileWallCollision(projectile, oldX, oldY) {
        for (const wall of this.lobby.walls) {
            if (
                this.lineIntersectsRect(oldX, oldY, projectile.x, projectile.y, wall)
            ) {
                return true;
            }
        }
        return false;
    }

    // Check if a line intersects with a rectangle
    lineIntersectsRect(x1, y1, x2, y2, rect) {
        // Check if either endpoint is inside the rectangle
        if (
            x1 >= rect.x &&
            x1 <= rect.x + rect.w &&
            y1 >= rect.y &&
            y1 <= rect.y + rect.h
        )
            return true;
        if (
            x2 >= rect.x &&
            x2 <= rect.x + rect.w &&
            y2 >= rect.y &&
            y2 <= rect.y + rect.h
        )
            return true;

        // Check line intersection with each edge of the rectangle
        const edges = [
            { x1: rect.x, y1: rect.y, x2: rect.x + rect.w, y2: rect.y }, // top
            {
                x1: rect.x + rect.w,
                y1: rect.y,
                x2: rect.x + rect.w,
                y2: rect.y + rect.h,
            }, // right
            {
                x1: rect.x + rect.w,
                y1: rect.y + rect.h,
                x2: rect.x,
                y2: rect.y + rect.h,
            }, // bottom
            { x1: rect.x, y1: rect.y + rect.h, x2: rect.x, y2: rect.y }, // left
        ];

        for (const edge of edges) {
            if (
                this.linesIntersect(x1, y1, x2, y2, edge.x1, edge.y1, edge.x2, edge.y2)
            ) {
                return true;
            }
        }

        return false;
    }

    // Check if two line segments intersect
    linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (denom === 0) return false; // parallel lines

        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    // Helper method for line-of-sight checking
    hasLineOfSight(x1, y1, x2, y2) {
        for (const wall of this.lobby.walls) {
            if (this.lineIntersectsRect(x1, y1, x2, y2, wall)) {
                return false;
            }
        }
        return true;
    }
}

module.exports = PhysicsSystem;