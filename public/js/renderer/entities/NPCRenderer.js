// NPC Renderer - Handles NPC rendering
class NPCRenderer {
    constructor(gameArea, gameObjects) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
    }

    renderNPC(npc, camera) {
        let el = this.gameObjects.get("npc");
        if (!el) {
            el = document.createElement("div");
            el.className = "game-npc";
            el.id = "npc";
            // simple visual
            el.style.width = "40px";
            el.style.height = "40px";
            el.style.borderRadius = "50%";
            el.style.backgroundColor = "#ff9933";
            el.style.border = "2px solid #ffffff";
            el.style.position = "absolute";
            el.style.pointerEvents = "none";
            el.style.zIndex = "5";
            // Health bar container
            const hp = document.createElement("div");
            hp.className = "npc-health";
            hp.style.position = "absolute";
            hp.style.bottom = "48px";
            hp.style.left = "50%";
            hp.style.transform = "translateX(-50%)";
            hp.style.width = "50px";
            hp.style.height = "6px";
            hp.style.background = "rgba(0,0,0,0.4)";
            hp.style.border = "1px solid #222";
            hp.style.borderRadius = "3px";
            const fill = document.createElement("div");
            fill.className = "npc-health-fill";
            fill.style.height = "100%";
            fill.style.width = "100%";
            fill.style.background = "#2ed573";
            fill.style.borderRadius = "2px";
            hp.appendChild(fill);
            el.appendChild(hp);
            this.gameArea.appendChild(el);
            this.gameObjects.set("npc", el);
        }
        const sx =
            (typeof npc.displayX === "number" ? npc.displayX : npc.x) - camera.x;
        const sy =
            (typeof npc.displayY === "number" ? npc.displayY : npc.y) - camera.y;
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
        el.style.transform = `translate(-50%, -50%)`;
        // Update HP bar
        const fill = el.querySelector(".npc-health-fill");
        if (fill) {
            const maxHp = npc.maxHealth || 200;
            const pct = Math.max(0, Math.min(1, (npc.health || maxHp) / maxHp));
            fill.style.width = `${pct * 100}%`;
            fill.style.background =
                pct > 0.5 ? "#2ed573" : pct > 0.25 ? "#ffa502" : "#ff4757";
        }
    }
}

// Make NPCRenderer available globally
// @ts-ignore
window.NPCRenderer = NPCRenderer;