// Weapons System
class Weapon {
    constructor(config) {
        this.name = config.name;
        this.damage = config.damage;
        this.fireRate = config.fireRate; // milliseconds between shots
        this.projectileSpeed = config.projectileSpeed;
        this.projectileSize = config.projectileSize;
        this.projectileLifetime = config.projectileLifetime;
        this.explosive = config.explosive || false;
        this.explosionRadius = config.explosionRadius || 0;
        this.explosionDamage = 0; // Server calculates actual damage
        this.ammo = config.ammo || Infinity;
        this.reloadTime = config.reloadTime || 0;
        this.spread = config.spread || 0; // accuracy spread in degrees
        this.recoil = config.recoil || 0; // recoil force
        this.sound = config.sound || "shoot";
        this.projectileColor = config.projectileColor || "#ffc107";
        this.projectileTrail = config.projectileTrail || false;
        this.projectileTrailLength = config.projectileTrailLength || 0;
        this.specialEffect = config.specialEffect || null;
    }

    // Create a projectile instance
    createProjectile(startX, startY, targetX, targetY, playerId) {
        const angle = Math.atan2(targetY - startY, targetX - startX);

        // Apply spread
        const spreadRad = (this.spread * Math.PI) / 180;
        const finalAngle = angle + (Math.random() - 0.5) * spreadRad;

        return {
            id: Date.now() + Math.random(),
            x: startX,
            y: startY,
            vx: Math.cos(finalAngle) * this.projectileSpeed,
            vy: Math.sin(finalAngle) * this.projectileSpeed,
            size: this.projectileSize,
            damage: this.damage,
            explosive: this.explosive,
            explosionRadius: this.explosionRadius,
            explosionDamage: this.explosionDamage,
            lifetime: this.projectileLifetime,
            maxLifetime: this.projectileLifetime,
            playerId: playerId,
            color: this.projectileColor,
            trail: this.projectileTrail,
            trailLength: this.projectileTrailLength,
            trailPoints: [],
            specialEffect: this.specialEffect,
        };
    }

    // Update projectile position
    updateProjectile(projectile, deltaTime) {
        projectile.x += projectile.vx * deltaTime;
        projectile.y += projectile.vy * deltaTime;
        projectile.lifetime -= deltaTime;

        // Update trail
        if (projectile.trail) {
            projectile.trailPoints.push({ x: projectile.x, y: projectile.y });
            if (projectile.trailPoints.length > projectile.trailLength) {
                projectile.trailPoints.shift();
            }
        }

        return projectile.lifetime > 0;
    }

    // Check if weapon can fire
    canFire(lastShotTime) {
        return Date.now() - lastShotTime >= this.fireRate;
    }

    // Get weapon info for UI
    getInfo() {
        return {
            name: this.name,
            damage: this.damage,
            fireRate: this.fireRate,
            ammo: this.ammo,
            explosive: this.explosive,
        };
    }
}

// Predefined weapons
const WEAPONS = {
    healerStaff: new Weapon({
        name: "Healer Staff",
        damage: 0,
        fireRate: 270,
        projectileSpeed: 500,
        projectileSize: 12,
        projectileLifetime: 2000,
        projectileColor: "#8be9fd",
    }),

    mageBolt: new Weapon({
        name: "Mage Bolt",
        damage: 0,
        fireRate: 250,
        projectileSpeed: 900,
        projectileSize: 10,
        projectileLifetime: 2000,
        projectileColor: "#bd93f9",
    }),

    meleeStrike: new Weapon({
        name: "Melee Strike",
        damage: 0,
        fireRate: 350,
        projectileSpeed: 1200,
        projectileSize: 24,
        projectileLifetime: 200,
        projectileColor: "#ffb86c",
    }),

    arrow: new Weapon({
        name: "Arrow",
        damage: 0,
        fireRate: 250,
        projectileSpeed: 950,
        projectileSize: 6,
        projectileLifetime: 2200,
        projectileColor: "#f1fa8c",
    }),
    pistol: new Weapon({
        name: "Pistol",
        damage: 0,
        fireRate: 170,
        projectileSpeed: 800,
        projectileSize: 15,
        projectileLifetime: 2000,
        projectileColor: "#ffc107",
    }),
};

// Weapon factory for creating custom weapons
class WeaponFactory {
    static createWeapon(config) {
        return new Weapon(config);
    }

    static getWeapon(name) {
        return WEAPONS[name] || WEAPONS.pistol;
    }

    static getAllWeapons() {
        return Object.keys(WEAPONS);
    }

    static getWeaponStats(name) {
        const weapon = WEAPONS[name];
        if (!weapon) return null;

        return {
            name: weapon.name,
            damage: weapon.damage,
            fireRate: weapon.fireRate,
            projectileSpeed: weapon.projectileSpeed,
            projectileSize: weapon.projectileSize,
            explosive: weapon.explosive,
            explosionRadius: weapon.explosionRadius,
            explosionDamage: weapon.explosionDamage,
            ammo: weapon.ammo,
            reloadTime: weapon.reloadTime,
            spread: weapon.spread,
            recoil: weapon.recoil,
        };
    }
}

// Make WEAPONS available globally
// @ts-ignore
window.WEAPONS = WEAPONS;
// @ts-ignore
window.Weapon = Weapon;
// @ts-ignore
window.WeaponFactory = WeaponFactory;