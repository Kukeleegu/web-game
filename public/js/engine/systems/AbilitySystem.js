// Ability System
class AbilitySystem {
    constructor(players, localPlayerId, getMouseState, soundManager) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.getMouseState = getMouseState;
        this.soundManager = soundManager;
    }

    useAbility(abilityName) {
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer) {
            const mouseState = this.getMouseState();
            if (localPlayer.useAbility(abilityName, mouseState.mouseX, mouseState.mouseY)) {
                // Play class-specific ability sound
                if (localPlayer.className) {
                    this.soundManager.playAbilitySound(localPlayer.className);
                } else {
                    this.soundManager.playSound("ability");
                }
            }
        }
    }

    // Update references when GameEngine properties change
    updateReferences(players, localPlayerId, getMouseState, soundManager) {
        this.players = players;
        this.localPlayerId = localPlayerId;
        this.getMouseState = getMouseState;
        this.soundManager = soundManager;
    }
}

// Make AbilitySystem available globally
// @ts-ignore
window.AbilitySystem = AbilitySystem;