class AreaEffectManager {
    constructor(lobby) {
        this.lobby = lobby;
        this.areaEffects = new Map();
    }

    updateAreaEffects(now, dt) {
        // Update area effects (healing zones, slow zones, etc.)
        if (!this.areaEffects) return;

        this.areaEffects.forEach((effect, effectId) => {
            if (effect.type === "healing" && effect.duration > 0) {
                effect.duration -= dt;

                // Heal players in range
                this.lobby.players.forEach((player) => {
                    if (player.health < 100) {
                        const dx = player.x - effect.x;
                        const dy = player.y - effect.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance <= effect.radius) {
                            player.health = Math.min(100, player.health + effect.healRate * dt);
                            if (this.lobby.io) {
                                this.lobby.io.to(this.lobby.id).emit("playerHealed", {
                                    playerId: player.id,
                                    newHealth: player.health,
                                    healAmount: effect.healRate * dt
                                });
                            }
                        }
                    }
                });

                // Remove expired effects
                if (effect.duration <= 0) {
                    this.areaEffects.delete(effectId);
                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("areaEffectRemoved", { effectId });
                    }
                }
            } else if (effect.type === "slow") {
                // Handle slow area effects
                if (now < effect.expiresAt) {
                    // Apply slow effect to zombies in range
                    if (this.lobby.waveManager && this.lobby.waveManager.zombies) {
                        this.lobby.waveManager.zombies.forEach((zombie) => {
                            const dx = zombie.x - effect.x;
                            const dy = zombie.y - effect.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            if (distance <= effect.radius) {
                                // Apply slow effect to zombie
                                zombie.slowUntil = now + 100; // Refresh slow effect every frame while in range
                            }
                        });
                    }
                } else {
                    // Remove expired slow effects
                    this.areaEffects.delete(effectId);
                    if (this.lobby.io) {
                        this.lobby.io.to(this.lobby.id).emit("areaEffectRemoved", { effectId });
                    }
                }
            }
        });
    }

    addAreaEffect(effect) {
        const effectId = `effect-${Date.now()}-${Math.random()}`;
        this.areaEffects.set(effectId, effect);
        return effectId;
    }

    removeAreaEffect(effectId) {
        this.areaEffects.delete(effectId);
    }

    clearAllEffects() {
        this.areaEffects.clear();
    }
}

module.exports = AreaEffectManager;