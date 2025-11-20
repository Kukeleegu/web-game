// Projectile Trail Renderer - Handles projectile trail rendering
class ProjectileTrailRenderer {
    constructor(gameArea, gameObjects) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
    }

    renderProjectileTrail(projectile, camera, projectileId) {
        // Only update trail every few frames to reduce performance impact
        if (!projectile._lastTrailUpdate) projectile._lastTrailUpdate = 0;
        const now = performance.now();
        if (now - projectile._lastTrailUpdate < 100) return; // Update max every 100ms (10 FPS)
        projectile._lastTrailUpdate = now;

        // Skip trail rendering for slow projectiles or if off-screen
        const velocity = projectile.vx * projectile.vx + projectile.vy * projectile.vy;
        if (velocity < 200) return; // Only render trails for fast projectiles

        const screenX = projectile.x - camera.x;
        const screenY = projectile.y - camera.y;
        const margin = 150;
        if (screenX < -margin || screenX > camera.width + margin ||
            screenY < -margin || screenY > camera.height + margin) {
            return; // Skip off-screen trails
        }

        // Remove old trail
        const oldTrail = this.gameObjects.get(`trail-${projectileId}`);
        if (oldTrail) {
            if (oldTrail.parentNode) {
                oldTrail.parentNode.removeChild(oldTrail);
            }
            this.gameObjects.delete(`trail-${projectileId}`);
        }

        // Only render trail if there are enough points
        if (projectile.trailPoints.length > 4) {
            const trailElement = document.createElement("div");
            trailElement.className = "projectile-trail";
            trailElement.id = `trail-${projectileId}`;

            // Create SVG path for trail
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const path = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
            );

            // Sample even fewer points for better performance
            const step = Math.max(2, Math.floor(projectile.trailPoints.length / 6));
            let pathData = "";
            for (let i = 0; i < projectile.trailPoints.length; i += step) {
                const point = projectile.trailPoints[i];
                const x = point.x - camera.x;
                const y = point.y - camera.y;
                if (pathData === "") {
                    pathData += `M ${x} ${y}`;
                } else {
                    pathData += ` L ${x} ${y}`;
                }
            }

            path.setAttribute("d", pathData);
            path.setAttribute("stroke", projectile.color);
            path.setAttribute("stroke-width", "1"); // Even thinner
            path.setAttribute("fill", "none");
            path.setAttribute("opacity", "0.3"); // More transparent

            svg.appendChild(path);
            trailElement.appendChild(svg);

            this.gameArea.appendChild(trailElement);
            this.gameObjects.set(`trail-${projectileId}`, trailElement);
        }
    }
}

// Make ProjectileTrailRenderer available globally
// @ts-ignore
window.ProjectileTrailRenderer = ProjectileTrailRenderer;