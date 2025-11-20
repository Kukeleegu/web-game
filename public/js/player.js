// Player System
class Player {
    static worldWidth = 1200;
    static worldHeight = 800;
    constructor(id, name, x, y) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.speed = 280; // base speed (not directly used but indicative)
        this.health = 100;
        this.maxHealth = 100;
        this.score = 0;
        this.kills = 0;
        this.deaths = 0;
        this.lives = 3; // Start with 3 lives
        this.isDead = false; // Track if player is currently dead
        this.respawnTime = 0; // When player can respawn
        this.lastShot = 0;
        this.lastAbilityUse = 0;

        // Abilities system
        this.abilities = new Map();
        this.activeEffects = new Map();

        // Weapon system
        this.currentWeapon = "pistol";
        this.weapons = ["pistol"];
        this.className = null; // mage | healer | ranged | melee
        this.blocking = false; // melee block state
        this.meleeCharge = 0; // charge built while blocking
        this.ammo = new Map();
        this.isReloading = false;
        this.reloadStartTime = 0;

        // Movement and physics
        // 3x faster overall feel
        this.friction = 0.9;
        this.acceleration = 2400;
        this.maxSpeed = 900;
        this.jumpForce = 400;
        // Top-down shooter: disable gravity by default
        this.gravity = 0;
        this.onGround = false;

        // Visual properties
        this.size = 40;
        this.color = "#667eea";
        this.borderColor = "#ffffff";
        this.isInvulnerable = false;
        this.invulnerabilityTime = 0;
        this.slowUntil = 0; // When slow effect ends
        this.flashInterval = null;

        // Input state
        this.keys = new Set();
        this.mouseX = 0;
        this.mouseY = 0;
        this.isShooting = false;
        this.shootingTimeoutId = null;

        // Animation
        this.animationFrame = 0;
        this.lastAnimationUpdate = 0;
        this.animationSpeed = 100; // ms per frame
    }

    // Add ability to player
    addAbility(ability) {
        this.abilities.set(ability.name, ability);
    }

    // Remove ability from player
    removeAbility(abilityName) {
        this.abilities.delete(abilityName);
    }

    // Use ability
    useAbility(abilityName, targetX, targetY) {
        const ability = this.abilities.get(abilityName);
        if (!ability) return false;

        if (Date.now() - this.lastAbilityUse < ability.cooldown) {
            return false; // Ability on cooldown
        }

        if (ability.use(this, targetX, targetY)) {
            this.lastAbilityUse = Date.now();
            return true;
        }

        return false;
    }

    // Add active effect
    addEffect(effectName, duration, effect) {
        this.activeEffects.set(effectName, {
            effect: effect,
            duration: duration,
            startTime: Date.now(),
        });
    }

    // Remove active effect
    removeEffect(effectName) {
        this.activeEffects.delete(effectName);
    }

    // Update active effects
    updateEffects(deltaTime) {
        const currentTime = Date.now();
        const expiredEffects = [];

        this.activeEffects.forEach((effectData, effectName) => {
            if (currentTime - effectData.startTime >= effectData.duration) {
                expiredEffects.push(effectName);
                if (effectData.effect.onExpire) {
                    effectData.effect.onExpire(this);
                }
            } else {
                if (effectData.effect.onUpdate) {
                    effectData.effect.onUpdate(this, deltaTime);
                }
            }
        });

        expiredEffects.forEach((effectName) => {
            this.removeEffect(effectName);
        });
    }

    // Change weapon
    changeWeapon(weaponName) {
        if (this.weapons.includes(weaponName)) {
            this.currentWeapon = weaponName;
            return true;
        }
        return false;
    }

    // Add weapon
    addWeapon(weaponName) {
        if (!this.weapons.includes(weaponName)) {
            this.weapons.push(weaponName);
            // Initialize ammo for the weapon
            const weapon = WEAPONS[weaponName];
            if (weapon && weapon.ammo !== Infinity) {
                this.ammo.set(weaponName, weapon.ammo);
            }
        }
    }

    // Get current weapon
    getCurrentWeapon() {
        return WEAPONS[this.currentWeapon];
    }

    // Check if can shoot
    canShoot() {
        // Dead players cannot shoot
        if (this.isDead) return false;

        const weapon = this.getCurrentWeapon();
        if (!weapon) return false;

        if (this.isReloading) return false;

        // Melee: if blocking, cannot shoot
        if (this.className === "melee" && this.blocking) return false;

        if (weapon.ammo !== Infinity) {
            const currentAmmo = this.ammo.get(this.currentWeapon) || 0;
            if (currentAmmo <= 0) return false;
        }

        return weapon.canFire(this.lastShot);
    }

    // Helper method to manage shooting timeout
    setShootingTimeout() {
        // Clear any existing timeout
        if (this.shootingTimeoutId) {
            clearTimeout(this.shootingTimeoutId);
        }

        this.isShooting = true;
        this.shootingTimeoutId = setTimeout(() => {
            this.isShooting = false;
            this.shootingTimeoutId = null;
        }, 100);
    }

    // Cleanup method to clear timeouts
    cleanup() {
        if (this.shootingTimeoutId) {
            clearTimeout(this.shootingTimeoutId);
            this.shootingTimeoutId = null;
        }
        if (this.flashInterval) {
            clearInterval(this.flashInterval);
            this.flashInterval = null;
        }
    }

    // Shoot weapon
    shoot(targetX, targetY) {
        if (!this.canShoot()) return null;

        const weapon = this.getCurrentWeapon();
        let damageBoost = 0;
        if (this.className === "melee" && this.meleeCharge > 0) {
            damageBoost = Math.min(40, this.meleeCharge);
            this.meleeCharge = 0;
        }

        // Special handling for melee characters - no projectile, just melee attack
        if (this.className === "melee") {
            const meleeAttack = {
                id: Date.now() + Math.random(),
                x: this.x,
                y: this.y,
                targetX: targetX,
                targetY: targetY,
                damage: weapon.damage + damageBoost,
                playerId: this.id,
                type: "meleeAttack",
                lifetime: 0.3, // 300ms duration
                maxLifetime: 0.3,
                angle: Math.atan2(targetY - this.y, targetX - this.x) * (180 / Math.PI),
            };

            this.lastShot = Date.now();
            return meleeAttack;
        }

        // Special handling for mage class - dual projectiles
        if (this.className === "mage") {
            const projectiles = [];
            // Use the same spread calculation as the server: 12 pixel perpendicular offset
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const len = Math.max(1e-6, Math.hypot(dx, dy));
            const nx = -dy / len; // perpendicular unit vector
            const ny = dx / len;
            const spread = 12; // pixels between parallel paths (same as server)

            // Create two projectiles with parallel paths
            const offsets = [spread, -spread];
            for (let i = 0; i < 2; i++) {
                const offsetX = targetX + nx * offsets[i];
                const offsetY = targetY + ny * offsets[i];

                const projectile = weapon.createProjectile(
                    this.x,
                    this.y,
                    offsetX,
                    offsetY,
                    this.id
                );
                if (damageBoost) {
                    projectile.damage += damageBoost;
                }
                projectiles.push(projectile);
            }

            this.lastShot = Date.now();

            // Consume ammo for both projectiles
            if (weapon.ammo !== Infinity) {
                const currentAmmo = this.ammo.get(this.currentWeapon) || 0;
                this.ammo.set(this.currentWeapon, Math.max(0, currentAmmo - 2));
            }

            return projectiles; // Return array of projectiles for mage
        }

        // Regular projectile for other classes
        const projectile = weapon.createProjectile(
            this.x,
            this.y,
            targetX,
            targetY,
            this.id
        );
        if (damageBoost) {
            projectile.damage += damageBoost;
        }

        this.lastShot = Date.now();

        // Consume ammo
        if (weapon.ammo !== Infinity) {
            const currentAmmo = this.ammo.get(this.currentWeapon) || 0;
            this.ammo.set(this.currentWeapon, currentAmmo - 1);
        }


        return projectile;
    }

    // Start reload
    startReload() {
        const weapon = this.getCurrentWeapon();
        if (!weapon || weapon.ammo === Infinity || this.isReloading) return false;

        this.isReloading = true;
        this.reloadStartTime = Date.now();

        // Set timeout to complete reload
        setTimeout(() => {
            this.completeReload();
        }, weapon.reloadTime);

        return true;
    }

    // Complete reload
    completeReload() {
        const weapon = this.getCurrentWeapon();
        if (weapon && weapon.ammo !== Infinity) {
            this.ammo.set(this.currentWeapon, weapon.ammo);
        }
        this.isReloading = false;
    }

    // Take damage
    takeDamage(damage, sourceId = null) {
        if (this.isInvulnerable) return false;

        this.health = Math.max(0, this.health - damage);

        // Flash effect when taking damage
        this.flash();

        // Check if player died
        if (this.health <= 0) {
            this.die(sourceId);
            return true;
        }

        return false;
    }

    // Heal player
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    // Player death
    die(sourceId = null) {
        this.deaths++;
        this.health = 0;

        // Clear any pending shooting timeout
        if (this.shootingTimeoutId) {
            clearTimeout(this.shootingTimeoutId);
            this.shootingTimeoutId = null;
        }

        // Reset position (respawn)
        this.x = Math.random() * 600 + 100; // Spawn within 800x600 area (100-700)
        this.y = Math.random() * 400 + 100; // Spawn within 800x600 area (100-500)
        this.vx = 0;
        this.vy = 0;

        // Reset health after respawn delay
        setTimeout(() => {
            this.health = this.maxHealth;
        }, 2000);
    }

    // Flash effect when taking damage
    flash() {
        if (this.flashInterval) return;

        let flashCount = 0;
        const maxFlashes = 6;

        this.flashInterval = setInterval(() => {
            this.borderColor = flashCount % 2 === 0 ? "#ff0000" : "#ffffff";
            flashCount++;

            if (flashCount >= maxFlashes) {
                clearInterval(this.flashInterval);
                this.flashInterval = null;
                this.borderColor = "#ffffff";
            }
        }, 100);
    }

    // Update player physics and movement
    update(deltaTime, walls = []) {
        // Update effects
        this.updateEffects(deltaTime);

        // Handle input
        this.handleInput(deltaTime);

        // Apply physics
        this.applyPhysics(deltaTime);
        // Apply slow if active (server communicates via applySlow visual; keep a local timer too if needed)
        if (this.slowUntil && Date.now() < this.slowUntil) {
            this.vx *= 0.8;
            this.vy *= 0.8;
        }
        this.resolveWallCollisions(walls);

        // Update invulnerability
        if (this.isInvulnerable) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.isInvulnerable = false;
            }
        }

        // Update animation
        this.updateAnimation(deltaTime);

        // Keep player in bounds
        this.keepInBounds();
    }

    // Handle player input
    handleInput(deltaTime) {
        // Dead players cannot move
        if (this.isDead) return;

        // Movement
        let moveX = 0;
        let moveY = 0;

        if (this.keys.has("w") || this.keys.has("arrowup") || this.keys.has("up")) {
            moveY -= 1;
        }
        if (
            this.keys.has("s") ||
            this.keys.has("arrowdown") ||
            this.keys.has("down")
        ) {
            moveY += 1;
        }
        if (
            this.keys.has("a") ||
            this.keys.has("arrowleft") ||
            this.keys.has("left")
        ) {
            moveX -= 1;
        }
        if (
            this.keys.has("d") ||
            this.keys.has("arrowright") ||
            this.keys.has("right")
        ) {
            moveX += 1;
        }

        // Movement input processed

        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707;
            moveY *= 0.707;
        }

        // Apply movement (consistent speed for all classes)
        let accelMultiplier = 1.5;
        let speedMultiplier = 1.6;

        if (moveX !== 0 || moveY !== 0) {
            this.vx += moveX * this.acceleration * accelMultiplier * deltaTime;
            this.vy += moveY * this.acceleration * accelMultiplier * deltaTime;
        }

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Limit speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxAllowed = this.maxSpeed * speedMultiplier;
        if (speed > maxAllowed) {
            this.vx = (this.vx / speed) * maxAllowed;
            this.vy = (this.vy / speed) * maxAllowed;
        }
    }

    // Apply physics
    applyPhysics(deltaTime) {
        // Top-down: no gravity or ground collision
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    // Simple AABB collision with walls (rectangles)
    resolveWallCollisions(walls) {
        const half = this.size / 2;
        const playerRect = {
            x: this.x - half,
            y: this.y - half,
            w: this.size,
            h: this.size,
        };

        for (const wall of walls) {
            if (
                playerRect.x < wall.x + wall.w &&
                playerRect.x + playerRect.w > wall.x &&
                playerRect.y < wall.y + wall.h &&
                playerRect.y + playerRect.h > wall.y
            ) {
                // Compute overlap on both axes
                const overlapX1 = wall.x + wall.w - playerRect.x; // from left
                const overlapX2 = playerRect.x + playerRect.w - wall.x; // from right
                const overlapY1 = wall.y + wall.h - playerRect.y; // from top
                const overlapY2 = playerRect.y + playerRect.h - wall.y; // from bottom

                const minOverlapX = Math.min(overlapX1, overlapX2);
                const minOverlapY = Math.min(overlapY1, overlapY2);

                if (minOverlapX < minOverlapY) {
                    // Resolve on X axis
                    if (overlapX1 < overlapX2) {
                        this.x += overlapX1;
                    } else {
                        this.x -= overlapX2;
                    }
                    this.vx = 0;
                } else {
                    // Resolve on Y axis
                    if (overlapY1 < overlapY2) {
                        this.y += overlapY1;
                    } else {
                        this.y -= overlapY2;
                    }
                    this.vy = 0;
                }

                // Update rect for potential further collisions in same frame
                playerRect.x = this.x - half;
                playerRect.y = this.y - half;
            }
        }
    }

    // Keep player in bounds
    keepInBounds() {
        const margin = this.size / 2;

        const worldW = Player.worldWidth || 800;
        const worldH = Player.worldHeight || 600;

        if (this.x < margin) {
            this.x = margin;
            this.vx = 0;
        }
        if (this.x > worldW - margin) {
            this.x = worldW - margin;
            this.vx = 0;
        }
        if (this.y < margin) {
            this.y = margin;
            this.vy = 0;
        }
        if (this.y > worldH - margin) {
            this.y = worldH - margin;
            this.vy = 0;
        }
    }

    // Static world size updated by GameEngine
    static setWorldSize(width, height) {
        Player.worldWidth = Math.max(1, Math.floor(width));
        Player.worldHeight = Math.max(1, Math.floor(height));
    }

    // Update animation
    updateAnimation(deltaTime) {
        if (Date.now() - this.lastAnimationUpdate > this.animationSpeed) {
            this.animationFrame = (this.animationFrame + 1) % 4;
            this.lastAnimationUpdate = Date.now();
        }
    }

    // Get player state for networking
    getState() {
        return {
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            health: this.health,
            maxHealth: this.maxHealth,
            score: this.score,
            kills: this.kills,
            deaths: this.deaths,
            lives: this.lives,
            isDead: this.isDead,
            respawnTime: this.respawnTime,
            currentWeapon: this.currentWeapon,
            isReloading: this.isReloading,
            isInvulnerable: this.isInvulnerable,
            animationFrame: this.animationFrame,
        };
    }

    // Set player state from network
    setState(state) {
        this.x = state.x;
        this.y = state.y;
        this.vx = state.vx;
        this.vy = state.vy;
        this.health = state.health;
        this.maxHealth = state.maxHealth;
        this.score = state.score;
        this.kills = state.kills;
        this.deaths = state.deaths;
        this.lives = state.lives;
        this.isDead = state.isDead;
        this.respawnTime = state.respawnTime;
        this.currentWeapon = state.currentWeapon;
        this.isReloading = state.isReloading;
        this.isInvulnerable = state.isInvulnerable;
        this.animationFrame = state.animationFrame;
    }

    // Check collision with another object
    checkCollision(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (this.size + other.size) / 2;

        return distance < minDistance;
    }

    // Get distance to another object
    getDistance(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Get angle to another object
    getAngleTo(other) {
        return Math.atan2(other.y - this.y, other.x - this.x);
    }
}

// Ability base class
class Ability {
    constructor(name, cooldown, duration = 0) {
        this.name = name;
        this.cooldown = cooldown; // milliseconds
        this.duration = duration; // milliseconds
    }

    use(player, targetX, targetY) {
        // Override in subclasses
        return false;
    }

    onUpdate(player, deltaTime) {
        // Override in subclasses
    }

    onExpire(player) {
        // Override in subclasses
    }
}

// Speed boost ability
class SpeedBoost extends Ability {
    constructor() {
        super("Speed Boost", 10000, 5000); // 10s cooldown, 5s duration
        this.speedMultiplier = 2.0;
    }

    use(player, targetX, targetY) {
        player.addEffect("speedBoost", this.duration, {
            onUpdate: (player, deltaTime) => {
                // Speed boost is now handled by movement multipliers
                // No need to modify speed properties directly
            },
            onExpire: (player) => {
                // Speed boost is now handled by movement multipliers
                // No need to modify speed properties directly
            },
        });
        return true;
    }
}

// Shield ability
class Shield extends Ability {
    constructor() {
        super("Shield", 15000, 8000); // 15s cooldown, 8s duration
        this.damageReduction = 0.5;
    }

    use(player, targetX, targetY) {
        player.addEffect("shield", this.duration, {
            onUpdate: (player, deltaTime) => {
                player.isInvulnerable = true;
            },
            onExpire: (player) => {
                player.isInvulnerable = false;
            },
        });
        return true;
    }
}

// Teleport ability
class Teleport extends Ability {
    constructor() {
        super("Teleport", 20000); // 20s cooldown
        this.range = 200;
    }

    use(player, targetX, targetY) {
        const distance = player.getDistance({ x: targetX, y: targetY });
        if (distance <= this.range) {
            player.x = targetX;
            player.y = targetY;
            player.vx = 0;
            player.vy = 0;
            return true;
        }
        return false;
    }
}

// Health regeneration ability
class HealthRegen extends Ability {
    constructor() {
        super("Health Regen", 12000, 10000); // 12s cooldown, 10s duration
        this.healAmount = 2; // health per second
    }

    use(player, targetX, targetY) {
        player.addEffect("healthRegen", this.duration, {
            onUpdate: (player, deltaTime) => {
                player.heal(this.healAmount * deltaTime);
            },
        });
        return true;
    }
}

// Weapon swap ability
class WeaponSwap extends Ability {
    constructor() {
        super("Weapon Swap", 8000); // 8s cooldown
    }

    use(player, targetX, targetY) {
        const availableWeapons = player.weapons.filter(
            (w) => w !== player.currentWeapon
        );
        if (availableWeapons.length > 0) {
            const randomWeapon =
                availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
            player.changeWeapon(randomWeapon);
            return true;
        }
        return false;
    }
}

// Predefined abilities
const ABILITIES = {
    speedBoost: new SpeedBoost(),
    shield: new Shield(),
    teleport: new Teleport(),
    healthRegen: new HealthRegen(),
    weaponSwap: new WeaponSwap(),
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
    module.exports = { Player, Ability, ABILITIES };
}

// Make classes available globally
// @ts-ignore
window.Player = Player;
// @ts-ignore
window.Ability = Ability;
// @ts-ignore
window.ABILITIES = ABILITIES;