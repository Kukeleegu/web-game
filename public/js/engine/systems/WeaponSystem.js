// Weapon System
class WeaponSystem {
    constructor(players, localPlayerId, isRunning, isPaused, getMouseState, projectileManager, effectManager, socket, soundManager) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.isRunning = isRunning;
        this.isPaused = isPaused;
        this.getMouseState = getMouseState;
        this.projectileManager = projectileManager;
        this.effectManager = effectManager;
        this.socket = socket;
        this.soundManager = soundManager;

        // Shooting state
        this.shootingInterval = null;
    }

    startShooting() {
        if (!this.isRunning || this.isPaused) return;

        const localPlayer = this.players.get(this.localPlayerId);
        if (!localPlayer) return;

        // Only fire immediately if player can actually shoot
        if (localPlayer.canShoot()) {
            this.shoot();
        }

        // Start continuous shooting timer
        if (!this.shootingInterval) {
            this.shootingInterval = setInterval(() => {
                const mouseState = this.getMouseState();
                if (mouseState.isLeftMouseDown && this.isRunning && !this.isPaused) {
                    const localPlayer = this.players.get(this.localPlayerId);
                    if (localPlayer && localPlayer.canShoot()) {
                        this.shoot();
                    }
                } else {
                    // Stop the interval if conditions are no longer met
                    this.stopShooting();
                }
            }, 50); // Check every 50ms for smooth continuous shooting
        }
    }

    stopShooting() {
        if (this.shootingInterval) {
            clearInterval(this.shootingInterval);
            this.shootingInterval = null;
        }
    }

    shoot() {
        const localPlayer = this.players.get(this.localPlayerId);
        if (!localPlayer) return;


        if (localPlayer.canShoot()) {
            // Aim at world coordinates, not screen-space
            const mouseState = this.getMouseState();
            const aimX =
                typeof mouseState.mouseWorldX === "number" ? mouseState.mouseWorldX : mouseState.mouseX;
            const aimY =
                typeof mouseState.mouseWorldY === "number" ? mouseState.mouseWorldY : mouseState.mouseY;
            const attackResult = localPlayer.shoot(aimX, aimY);
            if (attackResult) {
                // Handle melee attacks differently
                if (attackResult.type === "meleeAttack") {
                    // Add melee attack as an effect instead of projectile
                    this.effectManager.addEffect({
                        id: attackResult.id,
                        x: localPlayer.x,
                        y: localPlayer.y,
                        type: "meleeAttack",
                        lifetime: attackResult.lifetime,
                        maxLifetime: attackResult.maxLifetime,
                        angle: attackResult.angle,
                        playerId: localPlayer.id,
                    });
                } else if (Array.isArray(attackResult)) {
                    // Handle mage dual projectiles
                    attackResult.forEach((projectile) => {
                        this.projectileManager.addProjectile(projectile);
                    });
                } else {
                    // Regular single projectile
                    this.projectileManager.addProjectile(attackResult);
                }

                // Send shot to server
                this.socket.emit("playerShot", {
                    targetX: aimX,
                    targetY: aimY,
                    // Send minimal weapon data server needs for rate/damage/hit size
                    weapon: localPlayer.getCurrentWeapon(),
                    weaponKey: localPlayer.currentWeapon,
                    damageBoost: localPlayer.className === "melee" && localPlayer.meleeCharge ?
                        Math.min(40, localPlayer.meleeCharge) : 0,
                });

                // Play class-specific attack sound (only if not paused)
                if (localPlayer.className) {
                    this.soundManager.playAttackSound(localPlayer.className, this.isPaused);
                } else {
                    this.soundManager.playSoundIfNotPaused("shoot", this.isPaused);
                }
            }
        }
    }

    switchWeapon(weaponName) {
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer) {
            if (localPlayer.changeWeapon(weaponName)) {
                this.soundManager.playSound("weaponSwitch");
            }
        }
    }

    reloadWeapon() {
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer) {
            if (localPlayer.startReload()) {
                this.soundManager.playSound("reload");
            }
        }
    }

    // Update references when GameEngine properties change
    updateReferences(players, localPlayerId, isRunning, isPaused, getMouseState, projectileManager, effectManager, socket, soundManager) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.isRunning = isRunning;
        this.isPaused = isPaused;
        this.getMouseState = getMouseState;
        this.projectileManager = projectileManager;
        this.effectManager = effectManager;
        this.socket = socket;
        this.soundManager = soundManager;
    }
}

// Make WeaponSystem available globally
// @ts-ignore
window.WeaponSystem = WeaponSystem;