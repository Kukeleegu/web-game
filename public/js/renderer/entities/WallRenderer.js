// Wall Renderer - Handles wall rendering
class WallRenderer {
    constructor(gameArea, gameObjects) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
    }

    renderWalls(walls, camera) {
        walls.forEach((wall, idx) => {
            let el = this.gameObjects.get(`wall-${idx}`);
            if (!el) {
                el = document.createElement("div");
                el.className = "game-wall";
                el.id = `wall-${idx}`;
                this.gameArea.appendChild(el);
                this.gameObjects.set(`wall-${idx}`, el);
            }
            const sx = wall.x - camera.x;
            const sy = wall.y - camera.y;
            el.style.left = `${sx}px`;
            el.style.top = `${sy}px`;
            el.style.width = `${wall.w}px`;
            el.style.height = `${wall.h}px`;
            el.style.transform = `translate(0, 0)`;
        });
    }
}

// Make WallRenderer available globally
// @ts-ignore
window.WallRenderer = WallRenderer;