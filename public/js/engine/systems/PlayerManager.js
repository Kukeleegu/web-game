// Player Management System
class PlayerManager {
    constructor(players, localPlayerId, keys, camera) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.keys = keys;
        this.camera = camera;
    }

    addPlayer(id, name, x, y) {
        console.log(`Adding player: id=${id}, name="${name}", x=${x}, y=${y}`);
        // @ts-ignore
        const player = new(window).Player(id, name, x, y);

        // Debug: Log player object
        console.log("Created player object:", {
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
        });

        // Add some abilities to players
        // @ts-ignore
        const abilities = (window).ABILITIES;
        player.addAbility(abilities.speedBoost);
        player.addAbility(abilities.shield);
        player.addAbility(abilities.teleport);
        player.addAbility(abilities.healthRegen);
        player.addAbility(abilities.weaponSwap);

        // Add some weapons
        player.addWeapon("rifle");
        player.addWeapon("shotgun");
        player.addWeapon("sniper");
        player.addWeapon("explosive");
        player.addWeapon("laser");
        player.addWeapon("plasma");
        player.addWeapon("minigun");
        // Class weapons
        player.addWeapon("healerStaff");
        player.addWeapon("mageBolt");
        player.addWeapon("arrow");
        player.addWeapon("meleeStrike");

        this.players.set(id, player);
        console.log(
            `Player added to players Map. Total players: ${this.players.size}`
        );

        if (id === this.localPlayerId) {
            // debug disabled
            // Set up local player controls
            player.keys = this.keys;
            console.log(`Local player keys set: ${Array.from(this.keys).join(", ")}`);

            // Update camera to center on local player
            this.camera.updateCamera();
            // debug disabled
        }
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    // Update references when GameEngine properties change
    updateReferences(players, localPlayerId, keys, camera) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.keys = keys;
        this.camera = camera;

        // Update local player's keys reference
        if (this.localPlayerId) {
            const localPlayer = this.players.get(this.localPlayerId);
            if (localPlayer) {
                localPlayer.keys = this.keys;
            }
        }
    }
}

// Make PlayerManager available globally
// @ts-ignore
window.PlayerManager = PlayerManager;