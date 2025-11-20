// Projectile Renderer - Handles projectile rendering
class ProjectileRenderer {
    constructor(gameArea, gameObjects, projectileTrailRenderer) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
        this.projectileTrailRenderer = projectileTrailRenderer;

        // Object pooling for better performance
        this.projectilePool = [];
        this.poolSize = 50;
        this.performanceMode = false;
        this.initializePool();
    }

    initializePool() {
        for (let i = 0; i < this.poolSize; i++) {
            const element = document.createElement("div");
            element.className = "game-projectile";
            element.style.position = "absolute";
            element.style.pointerEvents = "none";
            element.style.display = "none";
            this.gameArea.appendChild(element);
            this.projectilePool.push(element);
        }
    }

    getPooledElement() {
        const element = this.projectilePool.find(el => el.style.display === "none");
        if (element) {
            element.style.display = "block";
            return element;
        }
        // If pool is exhausted, create new element
        const newElement = document.createElement("div");
        newElement.className = "game-projectile";
        newElement.style.position = "absolute";
        newElement.style.pointerEvents = "none";
        this.gameArea.appendChild(newElement);
        return newElement;
    }

    returnToPool(element) {
        element.style.display = "none";
        element.innerHTML = "";
        element.id = "";
        element.className = "game-projectile";
        // Reset all styling
        element.style.width = "";
        element.style.height = "";
        element.style.backgroundColor = "";
        element.style.borderRadius = "";
        element.style.background = "";
        element.style.boxShadow = "";
        element.style.border = "";
        element.style.transform = "";
    }

    renderProjectiles(projectiles, camera) {
        // Temporarily disable throttling to debug projectile rendering
        // if (!this._lastProjectileRender) this._lastProjectileRender = 0;
        // const now = performance.now();
        // const renderInterval = this.performanceMode ? 33 : 16; // 30 FPS vs 60 FPS
        // if (now - this._lastProjectileRender < renderInterval) return;
        // this._lastProjectileRender = now;

        // Mark all existing projectile elements for cleanup
        const activeKeys = new Set();

        projectiles.forEach((projectile, id) => {
            activeKeys.add(`projectile-${id}`);

            // Calculate screen position
            const screenX = projectile.x - camera.x;
            const screenY = projectile.y - camera.y;

            let projectileElement = this.gameObjects.get(`projectile-${id}`);

            if (!projectileElement) {
                // Get pooled element or create new one
                projectileElement = this.getPooledElement();
                projectileElement.id = `projectile-${id}`;
                projectileElement.style.width = `${projectile.size}px`;
                projectileElement.style.height = `${projectile.size}px`;
                projectileElement.style.backgroundColor = projectile.color;

                // Apply styling when projectile is created
                this.applyProjectileStyling(projectileElement, projectile);

                this.gameObjects.set(`projectile-${id}`, projectileElement);
            }

            // Use transform for better performance than left/top
            if (projectile.ownerType === "bossMob") {
                // Boss mob projectile positioning
                if (projectile.penetrating) {
                    // Boss ranged ability (penetrating)
                    const angle = Math.atan2(projectile.vy, projectile.vx) * (180 / Math.PI);
                    projectileElement.style.transform = `translate(${
            screenX - projectile.size * 2
          }px, ${screenY - projectile.size * 0.4}px) rotate(${angle}deg)`;
                } else {
                    // Boss regular projectile
                    projectileElement.style.transform = `translate(${
            screenX - projectile.size / 2
          }px, ${screenY - projectile.size / 2}px)`;
                }
            } else if (projectile.penetrating) {
                // Calculate rotation for penetrating arrows based on velocity
                const angle =
                    Math.atan2(projectile.vy, projectile.vx) * (180 / Math.PI);
                projectileElement.style.transform = `translate(${
          screenX - projectile.size * 2
        }px, ${screenY - projectile.size * 0.4}px) rotate(${angle}deg)`; // Updated to match basic arrow positioning
            } else if (projectile.color === "#f1fa8c") {
                // Calculate rotation for ranger's basic arrow based on velocity
                const angle =
                    Math.atan2(projectile.vy, projectile.vx) * (180 / Math.PI);
                projectileElement.style.transform = `translate(${
          screenX - projectile.size * 1.5
        }px, ${screenY - projectile.size * 0.4}px) rotate(${angle}deg)`;
            } else {
                projectileElement.style.transform = `translate(${
          screenX - projectile.size / 2
        }px, ${screenY - projectile.size / 2}px)`;
            }

            // Add trail effect if enabled - only for special projectiles and not in performance mode
            if (!this.performanceMode && projectile.trail && projectile.trailPoints.length > 0 &&
                (projectile.penetrating || projectile.ownerType === "bossMob")) {
                this.projectileTrailRenderer.renderProjectileTrail(projectile, camera, id);
            }
        });

        // Cleanup projectile elements that are no longer active
        const toRemove = [];
        this.gameObjects.forEach((element, key) => {
            if (key.startsWith("projectile-") && !activeKeys.has(key)) {
                toRemove.push(key);
            }
        });
        toRemove.forEach((key) => {
            const element = this.gameObjects.get(key);
            if (element) {
                this.returnToPool(element);
            }
            this.gameObjects.delete(key);
        });
    }

    applyProjectileStyling(element, projectile) {
        // Special styling for different projectile types
        if (projectile.ownerType === "bossMob") {
            // Boss mob projectiles - dark red with evil glow
            if (projectile.penetrating) {
                // Boss ranged ability (penetrating)
                element.style.width = `${projectile.size * 4}px`;
                element.style.height = `${projectile.size * 0.8}px`;
                element.style.borderRadius = `${projectile.size * 0.4}px`;
                element.style.background = `linear-gradient(90deg, #8b0000 0%, #dc143c 50%, #b22222 100%)`;
                element.style.boxShadow =
                    "0 0 25px rgba(139,0,0,1), 0 0 50px rgba(139,0,0,0.8), 0 0 75px rgba(139,0,0,0.6)";
                element.style.border = "2px solid #ff4500";
            } else {
                // Boss regular projectile
                element.style.width = `${projectile.size}px`;
                element.style.height = `${projectile.size}px`;
                element.style.borderRadius = "50%";
                element.style.background = `linear-gradient(45deg, #8b0000 0%, #dc143c 100%)`;
                element.style.boxShadow =
                    "0 0 20px rgba(139,0,0,1), 0 0 40px rgba(139,0,0,0.8)";
                element.style.border = "2px solid #ff4500";
            }
        } else if (projectile.penetrating) {
            // Make it more like basic arrow but bigger with glow - similar proportions to basic arrow
            element.style.width = `${projectile.size * 4}px`; // Keep same length
            element.style.height = `${projectile.size * 0.8}px`; // Same proportions as basic arrow
            element.style.borderRadius = `${projectile.size * 0.4}px`; // Same rounded style as basic arrow
            element.style.background = `linear-gradient(90deg, #f1fa8c 0%, #e6d700 50%, #d4c400 100%)`; // Same gradient as basic arrow
            element.style.boxShadow =
                "0 0 20px rgba(241,250,140,1), 0 0 40px rgba(241,250,140,0.6), 0 0 60px rgba(241,250,140,0.3)"; // Strong glow matching arrow color
            element.style.border = "1px solid #b8a800"; // Same border as basic arrow
        } else if (projectile.color === "#f1fa8c") {
            // Special styling for ranger's basic arrow - make it longer like an arrow
            element.style.width = `${projectile.size * 3}px`; // Make it 3x longer
            element.style.height = `${projectile.size * 0.8}px`; // Make it thinner
            element.style.borderRadius = `${projectile.size * 0.4}px`; // Rounded but not circular
            element.style.background = `linear-gradient(90deg, #f1fa8c 0%, #e6d700 50%, #d4c400 100%)`; // Arrow gradient
            element.style.border = "1px solid #b8a800";
        } else {
            element.style.borderRadius = "50%";
        }
    }

    // Method to update performance mode
    setPerformanceMode(performanceMode) {
        this.performanceMode = performanceMode;
    }
}

// Make ProjectileRenderer available globally
// @ts-ignore
window.ProjectileRenderer = ProjectileRenderer;