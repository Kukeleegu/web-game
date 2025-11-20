// Effect Renderer - Handles all visual effects rendering

class EffectRenderer {
    constructor(gameArea, gameObjects) {
        this.gameArea = gameArea;
        this.gameObjects = gameObjects;
        this.gameEngine = null; // Will be set by GameRenderer

        // Object pool for effects to reduce DOM creation/destruction
        this.effectPool = [];
        this.poolSize = 50; // Pre-create 50 effect elements
        this.initializePool();
    }

    initializePool() {
        for (let i = 0; i < this.poolSize; i++) {
            const effectElement = document.createElement("div");
            effectElement.className = "game-effect";
            effectElement.style.display = "none";
            this.gameArea.appendChild(effectElement);
            this.effectPool.push(effectElement);
        }
    }

    getPooledElement() {
        return this.effectPool.find(el => el.style.display === "none") ||
            this.createNewElement();
    }

    createNewElement() {
        const effectElement = document.createElement("div");
        effectElement.className = "game-effect";
        this.gameArea.appendChild(effectElement);
        return effectElement;
    }

    returnToPool(element) {
        element.style.display = "none";
        element.innerHTML = "";
    }

    setGameEngine(gameEngine) {
        this.gameEngine = gameEngine;
    }

    renderEffects(effects, camera) {
        if (!effects) {
            return;
        }

        // Mark all existing effect elements for cleanup
        const activeKeys = new Set();

        effects.forEach((effect, id) => {
            activeKeys.add(`effect-${id}`);
            // Handle special effects that follow players
            if (effect.followPlayerId) {
                const player = this.gameEngine && this.gameEngine.players.get(effect.followPlayerId);
                if (player) {
                    effect.x = player.x;
                    effect.y = player.y;
                }
            }

            const screenX = effect.x - camera.x;
            const screenY = effect.y - camera.y;

            let effectElement = this.gameObjects.get(`effect-${id}`);

            if (!effectElement) {
                // Get pooled element or create new one
                effectElement = this.getPooledElement();
                effectElement.id = `effect-${id}`;
                effectElement.style.display = "block";

                this.gameObjects.set(`effect-${id}`, effectElement);
            }

            // Update position
            effectElement.style.left = `${screenX}px`;
            effectElement.style.top = `${screenY}px`;
            effectElement.style.transform = `translate(-50%, -50%)`;

            // Render different effect types
            switch (effect.type) {
                case "explosion":
                    this.renderExplosion(effectElement, effect);
                    break;
                case "heal":
                    this.renderHealEffect(effectElement, effect);
                    break;
                case "speed":
                    this.renderSpeedEffect(effectElement, effect);
                    break;
                case "slow":
                    this.renderSlowEffect(effectElement, effect);
                    break;
                case "block":
                    this.renderBlockEffect(effectElement, effect);
                    break;
                case "meleeAttack":
                    this.renderMeleeAttackEffect(effectElement, effect);
                    break;
                case "slam":
                    this.renderSlamEffect(effectElement, effect);
                    break;
                case "wallHit":
                    this.renderWallHitEffect(effectElement, effect);
                    break;
                default:
                    // Create a basic fallback effect
                    effectElement.style.width = "40px";
                    effectElement.style.height = "40px";
                    effectElement.style.backgroundColor = "#ff0000";
                    effectElement.style.borderRadius = "50%";
                    effectElement.style.opacity = effect.lifetime / effect.maxLifetime;
                    break;
            }
        });

        // Cleanup effect elements that are no longer active
        const toRemove = [];
        this.gameObjects.forEach((element, key) => {
            if (key.startsWith("effect-") && !activeKeys.has(key)) {
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

    // Individual effect rendering methods will be added here
    renderExplosion(effectElement, effect) {
        const radius = effect.radius;
        const alpha = effect.lifetime / effect.maxLifetime;

        effectElement.style.width = `${radius * 2}px`;
        effectElement.style.height = `${radius * 2}px`;
        effectElement.style.backgroundColor = "#ff4757";
        effectElement.style.borderRadius = "50%";
        effectElement.style.opacity = alpha;
    }

    renderHealEffect(effectElement, effect) {
        const size = 36;
        const alpha = effect.lifetime / effect.maxLifetime;

        // Draw a plus-like shape using CSS: two rectangles overlapped
        effectElement.style.width = `${size}px`;
        effectElement.style.height = `${size}px`;
        effectElement.style.background = "none";
        effectElement.innerHTML = "";

        const vert = document.createElement("div");
        const horiz = document.createElement("div");

        [vert, horiz].forEach((el) => {
            el.style.position = "absolute";
            el.style.backgroundColor = "#2ed573";
            el.style.borderRadius = "3px";
            el.style.opacity = alpha.toString();
        });

        vert.style.width = `${Math.max(6, size * 0.2)}px`;
        vert.style.height = `${size}px`;
        vert.style.left = `${(size - parseFloat(vert.style.width)) / 2}px`;
        vert.style.top = `0px`;

        horiz.style.height = `${Math.max(6, size * 0.2)}px`;
        horiz.style.width = `${size}px`;
        horiz.style.top = `${(size - parseFloat(horiz.style.height)) / 2}px`;
        horiz.style.left = `0px`;

        effectElement.appendChild(vert);
        effectElement.appendChild(horiz);
        effectElement.style.opacity = alpha;
    }

    renderSpeedEffect(effectElement, effect) {
        const size = effect.radius ? effect.radius * 2 : 40;
        const alpha = effect.lifetime / effect.maxLifetime;

        // Full-size disk (no growth), fading out
        effectElement.style.width = `${size}px`;
        effectElement.style.height = `${size}px`;
        effectElement.style.backgroundColor = "rgba(255,165,2,0.5)";
        effectElement.style.border = "2px solid #ffa502";
        effectElement.style.borderRadius = "50%";
        effectElement.style.opacity = alpha;
    }

    renderSlowEffect(effectElement, effect) {
        const radius = effect.radius || 80;
        const lifetime = effect.lifetime || 0.5;
        const maxLifetime = effect.maxLifetime || 0.5;
        const progress = lifetime / maxLifetime;

        // Create a pulsing blue circle for slow effect
        const opacity = Math.max(0.1, progress * 0.6); // Fade out over time
        const scale = 0.8 + (1 - progress) * 0.4; // Slight scale animation

        effectElement.style.width = `${radius * 2}px`;
        effectElement.style.height = `${radius * 2}px`;
        effectElement.style.borderRadius = '50%';
        effectElement.style.border = `3px solid rgba(100, 150, 255, ${opacity})`;
        effectElement.style.backgroundColor = `rgba(100, 150, 255, ${opacity * 0.2})`;
        effectElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
        effectElement.style.pointerEvents = 'none';
        effectElement.style.zIndex = '10';

        // Add pulsing animation
        effectElement.style.animation = `slowPulse 1s ease-in-out infinite`;
    }

    renderBlockEffect(effectElement, effect) {
        // Create a C-shaped shield around the melee character
        const shieldSize = 80;
        const angle = effect.angle || 0;

        effectElement.style.width = `${shieldSize}px`;
        effectElement.style.height = `${shieldSize}px`;
        effectElement.style.background = "none";
        effectElement.style.border = "none";
        effectElement.style.borderRadius = "50%";
        effectElement.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        effectElement.style.opacity = "0.9";
        effectElement.style.boxShadow = "0 0 20px rgba(0,123,255,0.6)";

        // Clear any existing content
        effectElement.innerHTML = "";

        // Create C-shaped shield using CSS clip-path
        effectElement.style.background = "rgba(0,123,255,0.8)";
        effectElement.style.clipPath =
            "polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%, 50% 80%, 80% 80%, 80% 20%, 50% 20%)";
    }

    renderMeleeAttackEffect(effectElement, effect) {
        // Create a more realistic sword slash visual
        const swordLength = 120; // Match actual melee hitbox range
        const swordWidth = 4; // 2x narrower, more sword-like
        const alpha = effect.lifetime / effect.maxLifetime;
        const angle = effect.angle || 0;

        // Calculate animation progress for dynamic effects
        const progress = 1 - alpha; // 0 = start, 1 = end

        // Create sword blade with metallic gradient
        effectElement.style.width = `${swordLength}px`;
        effectElement.style.height = `${swordWidth}px`;
        effectElement.style.background = `
          linear-gradient(90deg, 
            #c0c0c0 0%, 
            #e8e8e8 15%, 
            #ffffff 30%, 
            #e8e8e8 50%, 
            #c0c0c0 70%, 
            #a0a0a0 85%, 
            #808080 100%
          )
        `;

        // Add sword details
        effectElement.style.border = "1px solid #606060";
        effectElement.style.borderRadius = "2px";
        effectElement.style.transformOrigin = "0% 50%"; // Rotate from left edge (character center)

        // Position sword to start from character center and extend outward in attack direction
        effectElement.style.transform = `translate(0%, -50%) rotate(${angle}deg)`;

        // Dynamic opacity and effects based on animation progress
        effectElement.style.opacity = alpha;

        // Add metallic shine effect that moves across the blade
        const shineOffset = progress * swordLength;
        effectElement.style.background = `
          linear-gradient(90deg, 
            #c0c0c0 0%, 
            #e8e8e8 15%, 
            #ffffff 30%, 
            #e8e8e8 50%, 
            #c0c0c0 70%, 
            #a0a0a0 85%, 
            #808080 100%
          ),
          linear-gradient(90deg, 
            transparent 0%, 
            transparent ${shineOffset - 20}px, 
            rgba(255,255,255,0.8) ${shineOffset}px, 
            rgba(255,255,255,0.4) ${shineOffset + 20}px, 
            transparent ${shineOffset + 40}px, 
            transparent 100%
          )
        `;

        // Add glow effect that intensifies at the start and fades
        const glowIntensity = Math.sin(progress * Math.PI) * 0.8 + 0.2;
        effectElement.style.boxShadow = `
          0 0 ${15 * glowIntensity}px rgba(128,128,128,${glowIntensity * 0.6}),
          0 0 ${8 * glowIntensity}px rgba(255,255,255,${glowIntensity * 0.4}),
          inset 0 0 ${swordWidth * 0.3}px rgba(255,255,255,0.1)
        `;

        // Add motion blur effect for faster slashes
        if (progress < 0.3) {
            effectElement.style.filter = `blur(${1 - progress * 3}px)`;
        } else {
            effectElement.style.filter = "blur(0px)";
        }

        // Add sword hilt (handle) effect at the center
        let hilt = effectElement.querySelector(".sword-hilt");
        if (!hilt) {
            hilt = document.createElement("div");
            hilt.className = "sword-hilt";
            effectElement.appendChild(hilt);
        }
        hilt.style.position = "absolute";
        hilt.style.left = "25%";
        hilt.style.top = "50%";
        hilt.style.width = "16px";
        hilt.style.height = "16px";
        hilt.style.background = "linear-gradient(45deg, #8B4513, #A0522D, #8B4513)";
        hilt.style.border = "1px solid #654321";
        hilt.style.borderRadius = "50%";
        hilt.style.transform = "translate(-50%, -50%)";
        hilt.style.boxShadow = "inset 0 0 4px rgba(0,0,0,0.5)";
        hilt.style.zIndex = "10";
        hilt.style.display = "block";

        // Add sword guard (crossguard) effect perpendicular to the blade
        let guard = effectElement.querySelector(".sword-guard");
        if (!guard) {
            guard = document.createElement("div");
            guard.className = "sword-guard";
            effectElement.appendChild(guard);
        }
        guard.style.position = "absolute";
        guard.style.left = "25%";
        guard.style.top = "50%";
        guard.style.width = "24px";
        guard.style.height = "4px";
        guard.style.background = "linear-gradient(90deg, #B8860B, #DAA520, #B8860B)";
        guard.style.border = "1px solid #8B6914";
        guard.style.borderRadius = "2px";
        guard.style.transform = "translate(-50%, -50%) rotate(90deg)";
        guard.style.boxShadow = "inset 0 0 2px rgba(0,0,0,0.3)";
        guard.style.zIndex = "10";
        guard.style.display = "block";

        // Add trail effect for faster slashes
        if (progress < 0.5) {
            const trailOpacity = (0.5 - progress) * 2;
            effectElement.style.boxShadow += `, 0 0 ${20 * trailOpacity}px rgba(128,128,128,${trailOpacity * 0.3})`;
        }

        // Add particle effects for enhanced visual impact
        if (progress < 0.2 && !effectElement.querySelector(".sword-particles")) {
            const particlesContainer = document.createElement("div");
            particlesContainer.className = "sword-particles";
            particlesContainer.style.position = "absolute";
            particlesContainer.style.left = "0";
            particlesContainer.style.top = "0";
            particlesContainer.style.width = "100%";
            particlesContainer.style.height = "100%";
            particlesContainer.style.pointerEvents = "none";

            // Create multiple particles with varied properties
            for (let i = 0; i < 12; i++) {
                const particle = document.createElement("div");
                const size = 2 + Math.random() * 4;
                const particleX = Math.random() * 100;
                const particleY = Math.random() * 100;

                particle.style.position = "absolute";
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.backgroundColor = i % 3 === 0 ? "#FFD700" : i % 3 === 1 ? "#FFA500" : "#FF6B35";
                particle.style.borderRadius = "50%";
                particle.style.left = `${particleX}%`;
                particle.style.top = `${particleY}%`;

                // Set custom properties for varied particle movement
                const moveX = (Math.random() - 0.5) * 60;
                const moveY = (Math.random() - 0.5) * 60;
                particle.style.setProperty('--particle-x', `${moveX}px`);
                particle.style.setProperty('--particle-y', `${moveY}px`);

                // Varied animation timing and duration
                const duration = 0.3 + Math.random() * 0.4;
                const delay = Math.random() * 0.2;
                particle.style.animation = `particleFloat ${duration}s ease-out ${delay}s forwards`;

                particlesContainer.appendChild(particle);
            }

            effectElement.appendChild(particlesContainer);
        }

        // Add screen shake effect for powerful attacks
        if (effect.slashIntensity > 1.2 && progress < 0.3) {
            const shakeIntensity = (effect.slashIntensity - 1.0) * 2;
            const shakeX = (Math.random() - 0.5) * shakeIntensity;
            const shakeY = (Math.random() - 0.5) * shakeIntensity;
            effectElement.style.transform += ` translate(${shakeX}px, ${shakeY}px)`;
        }
    }

    renderSlamEffect(effectElement, effect) {
        // Create a powerful ground slam visual effect
        const radius = effect.radius || 100;
        const alpha = effect.lifetime / effect.maxLifetime;

        // Create expanding shockwave effect
        const currentRadius = radius * (1 - alpha); // Starts small, expands outward

        effectElement.style.width = `${currentRadius * 2}px`;
        effectElement.style.height = `${currentRadius * 2}px`;
        effectElement.style.background = `radial-gradient(circle, rgba(255,165,0,${
          alpha * 0.8
        }) 0%, rgba(255,69,0,${alpha * 0.6}) 40%, rgba(139,69,19,${
          alpha * 0.3
        }) 80%, transparent 100%)`;
        effectElement.style.borderRadius = "50%";
        effectElement.style.border = `3px solid rgba(255,140,0,${alpha})`;
        effectElement.style.boxShadow = `0 0 ${
          20 + currentRadius * 0.2
        }px rgba(255,140,0,${alpha * 0.7})`;
        effectElement.style.transform = `translate(-50%, -50%)`;
    }

    renderWallHitEffect(effectElement, effect) {
        const radius = effect.radius;
        const alpha = effect.lifetime / effect.maxLifetime;

        effectElement.style.width = `${radius * 2}px`;
        effectElement.style.height = `${radius * 2}px`;
        effectElement.style.backgroundColor = "#8b4513"; // Brown color for wall hits
        effectElement.style.borderRadius = "50%";
        effectElement.style.opacity = alpha;
        effectElement.style.border = `2px solid #654321`;
        effectElement.style.boxShadow = `0 0 ${radius}px rgba(139, 69, 19, 0.6)`;

        // Add some debris effect
        if (!effectElement.querySelector(".debris")) {
            const debris = document.createElement("div");
            debris.className = "debris";
            debris.style.position = "absolute";
            debris.style.width = "4px";
            debris.style.height = "4px";
            debris.style.backgroundColor = "#654321";
            debris.style.borderRadius = "50%";
            debris.style.left = "50%";
            debris.style.top = "50%";
            debris.style.transform = "translate(-50%, -50%)";
            effectElement.appendChild(debris);
        }
    }
}

// Make EffectRenderer available globally
if (typeof window !== 'undefined') {
    // @ts-ignore
    window.EffectRenderer = EffectRenderer;
} else {
    console.error('window object not available');
}