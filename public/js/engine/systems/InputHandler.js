// Input Handler System
class InputHandler {
    constructor(gameArea, keys, camera, players, localPlayerId, currentLobbyId, socket, switchWeapon, reloadWeapon, useAbility, startShooting, stopShooting, weapons) {
        this.gameArea = gameArea;
        this.keys = keys;
        this.camera = camera;
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.currentLobbyId = currentLobbyId;
        this.socket = socket;
        this.switchWeapon = switchWeapon;
        this.reloadWeapon = reloadWeapon;
        this.useAbility = useAbility;
        this.startShooting = startShooting;
        this.stopShooting = stopShooting;
        this.weapons = weapons;

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;
        this.isMouseDown = false;
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener("keydown", (e) => {
            // Prevent page scroll on arrow keys/space while playing
            if (
                ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
            ) {
                e.preventDefault();
            }
            this.keys.add(e.key.toLowerCase());

            // Weapon switching
            if (e.key >= "1" && e.key <= "9") {
                const weaponIndex = parseInt(e.key) - 1;
                const weaponNames = Object.keys(this.weapons);
                if (weaponIndex < weaponNames.length) {
                    this.switchWeapon(weaponNames[weaponIndex]);
                }
            }

            // Reload
            if (e.key === "r") {
                this.reloadWeapon();
            }

            // Abilities
            if (e.key === "q") {
                this.useAbility("speedBoost");
            }
            if (e.key === "e") {
                this.useAbility("shield");
            }
            if (e.key === "f") {
                this.useAbility("teleport");
            }
            if (e.key === "g") {
                this.useAbility("healthRegen");
            }
            if (e.key === "h") {
                this.useAbility("weaponSwap");
            }
        });

        document.addEventListener("keyup", (e) => {
            this.keys.delete(e.key.toLowerCase());
        });

        // Mouse events
        this.gameArea.addEventListener("mousemove", (e) => {
            const rect = this.gameArea.getBoundingClientRect();
            // Account for CSS scale to map back to world-space coordinates
            const localX = (e.clientX - rect.left) / (this.camera.getScale() || 1);
            const localY = (e.clientY - rect.top) / (this.camera.getScale() || 1);
            // Screen-space inside game area (unscaled)
            this.mouseX = localX;
            this.mouseY = localY;
            // Convert to world-space using camera
            const camera = this.camera.getCamera();
            this.mouseWorldX = camera.x + this.mouseX;
            this.mouseWorldY = camera.y + this.mouseY;

            // Mouse movement is now only used for aiming, not for shooting
            // Continuous shooting is handled by the timer in startShooting()

            // Reduced logging for performance
            // console.log(`Mouse screen: (${this.mouseX}, ${this.mouseY}) world: (${this.mouseWorldX}, ${this.mouseWorldY})`);
        });

        this.gameArea.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                this.isLeftMouseDown = true;
                this.isMouseDown = true;
            }
            if (e.button === 2) {
                this.isRightMouseDown = true;
                this.isMouseDown = true;
                // Right click abilities per class
                const me = this.players.get(this.localPlayerId);
                if (me) {
                    switch (me.className) {
                        case "healer":
                            // server-authoritative heal
                            if (this.currentLobbyId) {
                                this.socket.emit("abilityUse", {
                                    lobbyId: this.currentLobbyId,
                                    type: "healer_heal",
                                    x: this.mouseWorldX,
                                    y: this.mouseWorldY,
                                });
                            }
                            break;
                        case "mage":
                            // server-authoritative slow
                            if (this.currentLobbyId) {
                                this.socket.emit("abilityUse", {
                                    lobbyId: this.currentLobbyId,
                                    type: "mage_slow",
                                    x: this.mouseWorldX,
                                    y: this.mouseWorldY,
                                });
                            }
                            break;
                        case "ranged":
                            // server-authoritative penetrating arrow
                            if (this.currentLobbyId) {
                                this.socket.emit("abilityUse", {
                                    lobbyId: this.currentLobbyId,
                                    type: "penetrating_arrow",
                                    x: this.mouseWorldX,
                                    y: this.mouseWorldY,
                                });
                            }
                            break;
                        case "melee":
                            // Knockback slam ability
                            if (this.currentLobbyId) {
                                this.socket.emit("abilityUse", {
                                    lobbyId: this.currentLobbyId,
                                    type: "melee_slam",
                                    x: this.mouseWorldX,
                                    y: this.mouseWorldY,
                                });
                            }
                            break;
                    }
                }
            }
            // Start or continue shooting only for left click
            if (e.button === 0) {
                this.startShooting();
            }
        });

        this.gameArea.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this.isLeftMouseDown = false;
            }
            if (e.button === 2) {
                this.isRightMouseDown = false;
                // Right click released - no special handling needed for melee slam
            }
            // Only stop shooting when left button is released
            if (e.button === 0) {
                this.stopShooting();
            }
        });

        // Context menu prevention
        this.gameArea.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        // Window focus events
        window.addEventListener("focus", () => {
            this.keys.clear();
        });

        window.addEventListener("blur", () => {
            this.keys.clear();
        });

        // Prevent arrow keys from scrolling while focused anywhere
        window.addEventListener(
            "keydown",
            (e) => {
                if (
                    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
                        e.key
                    )
                ) {
                    e.preventDefault();
                }
            }, { passive: false }
        );
    }

    // Update references when GameEngine properties change
    updateReferences(gameArea, keys, camera, players, localPlayerId, currentLobbyId, socket, switchWeapon, reloadWeapon, useAbility, startShooting, stopShooting, weapons) {
        this.gameArea = gameArea;
        this.keys = keys;
        this.camera = camera;
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.currentLobbyId = currentLobbyId;
        this.socket = socket;
        this.switchWeapon = switchWeapon;
        this.reloadWeapon = reloadWeapon;
        this.useAbility = useAbility;
        this.startShooting = startShooting;
        this.stopShooting = stopShooting;
        this.weapons = weapons;
    }

    // Get mouse state
    getMouseState() {
        return {
            mouseX: this.mouseX,
            mouseY: this.mouseY,
            mouseWorldX: this.mouseWorldX,
            mouseWorldY: this.mouseWorldY,
            isMouseDown: this.isMouseDown,
            isLeftMouseDown: this.isLeftMouseDown,
            isRightMouseDown: this.isRightMouseDown
        };
    }
}

// Make InputHandler available globally
// @ts-ignore
window.InputHandler = InputHandler;