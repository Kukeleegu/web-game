// Camera and Scaling System
class Camera {
    constructor(gameArea, worldWidth, worldHeight) {
        this.gameArea = gameArea;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.scale = 1; // CSS scale applied to gameArea for responsive fit
    }

    updateCamera(localPlayer = null) {
        // Fixed world size regardless of viewport
        const worldW = this.worldWidth;
        const worldH = this.worldHeight;

        // Static camera - always at top-left corner
        this.camera.x = 0;
        this.camera.y = 0;

        // Share world size with Player bounds system
        if (typeof Player.setWorldSize === "function") {
            Player.setWorldSize(worldW, worldH);
        }
    }

    // Scale the fixed world to fill the browser window while preserving aspect ratio
    updateScale() {
        if (!this.gameArea) return;
        const vw = window.innerWidth || document.documentElement.clientWidth || 1;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        const sx = vw / this.worldWidth;
        const sy = vh / this.worldHeight;
        const s = Math.min(sx, sy);
        this.scale = s;
        this.gameArea.style.transform = `scale(${s})`;
        const scaledW = this.worldWidth * s;
        const scaledH = this.worldHeight * s;
        const left = Math.max(0, (vw - scaledW) / 2);
        const top = Math.max(0, (vh - scaledH) / 2);
        this.gameArea.style.left = `${left}px`;
        this.gameArea.style.top = `${top}px`;
    }

    // Get camera position
    getCamera() {
        return this.camera;
    }

    // Get current scale
    getScale() {
        return this.scale;
    }
}

// Make Camera available globally
// @ts-ignore
window.Camera = Camera;