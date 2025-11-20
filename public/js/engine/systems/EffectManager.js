// Effect Management System
class EffectManager {
    constructor(effects) {
        this.effects = effects;
    }

    addEffect(effectData) {
        this.effects.set(effectData.id, effectData);
    }

    updateEffects(deltaTime) {
        const expiredEffects = [];

        this.effects.forEach((effect, id) => {
            effect.lifetime -= deltaTime;
            if (effect.lifetime <= 0) {
                expiredEffects.push(id);
            }
        });

        expiredEffects.forEach((id) => {
            this.effects.delete(id);
        });
    }

    // Update references when GameEngine properties change
    updateReferences(effects) {
        this.effects = effects;
    }
}

// Make EffectManager available globally
// @ts-ignore
window.EffectManager = EffectManager;