/**
 * Infer weapon key from class name
 */
function inferWeaponKeyFromClass(className) {
    switch (className) {
        case "healer":
            return "healerStaff";
        case "mage":
            return "mageBolt";
        case "ranged":
            return "arrow";
        case "melee":
            return "meleeStrike";
        default:
            return "pistol";
    }
}

/**
 * Normalize weapon stats for server-side projectile simulation
 */
function normalizeWeapon(weaponKey, weaponObj, className) {
    const defaults = {
        pistol: {
            damage: 20,
            fireRate: 170,
            projectileSpeed: 800,
            projectileSize: 15,
            projectileLifetime: 2.0,
        },
        healerStaff: {
            damage: 30,
            fireRate: 270,
            projectileSpeed: 500,
            projectileSize: 12,
            projectileLifetime: 2.0,
        },
        mageBolt: {
            damage: 22,
            fireRate: 250,
            projectileSpeed: 900,
            projectileSize: 10,
            projectileLifetime: 2.0,
        },
        arrow: {
            damage: 40,
            fireRate: 250,
            projectileSpeed: 950,
            projectileSize: 6,
            projectileLifetime: 2.2,
        },
        meleeStrike: {
            damage: 45,
            fireRate: 350,
            projectileSpeed: 1200,
            projectileSize: 24,
            projectileLifetime: 0.2,
        },
    };
    const fallbackKey = weaponKey || inferWeaponKeyFromClass(className);
    const base = defaults[fallbackKey] || defaults.pistol;

    // If weaponObj is null, use only server defaults (for security)
    if (weaponObj === null) {
        return {
            damage: base.damage,
            fireRate: base.fireRate,
            projectileSpeed: base.projectileSpeed,
            projectileSize: base.projectileSize,
            projectileLifetime: base.projectileLifetime,
            explosive: base.explosive || false,
            explosionRadius: base.explosionRadius || 0,
            explosionDamage: base.explosionDamage || 0,
        };
    }

    const w = weaponObj && typeof weaponObj === "object" ? weaponObj : {};
    return {
        damage: Number(w.damage) || base.damage,
        fireRate: Number(w.fireRate) || base.fireRate,
        projectileSpeed: Number(w.projectileSpeed) || base.projectileSpeed,
        projectileSize: Number(w.projectileSize) || base.projectileSize,
        // client sends ms sometimes; accept seconds number otherwise
        projectileLifetime: typeof w.projectileLifetime === "number" && w.projectileLifetime > 50 ?
            w.projectileLifetime / 1000 : Number(w.projectileLifetime) || base.projectileLifetime,
        explosive: w.explosive !== undefined ? w.explosive : (base.explosive || false),
        explosionRadius: Number(w.explosionRadius) || base.explosionRadius || 0,
        explosionDamage: Number(w.explosionDamage) || base.explosionDamage || 0,
    };
}

module.exports = {
    inferWeaponKeyFromClass,
    normalizeWeapon
};