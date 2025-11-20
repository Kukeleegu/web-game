// Sound Manager
class SoundManager {
    constructor() {
        this.sounds = new Map();
        this.muted = false;
        this.volume = 0.3; // Reduced from 0.5 to 0.3
        this.soundtrackPlaying = false;
        this.initSounds();
    }

    initSounds() {
        // Initialize sound effects using external files
        this.sounds.set("shoot", this.createSound("sounds/ranged%20B.wav")); // Generic attack sound
        this.sounds.set("hit", this.createSound("sounds/ranged%20B.wav")); // Generic hit sound
        this.sounds.set("gameStart", this.createSound("sounds/ranged%20B.wav")); // Generic game sound
        this.sounds.set("gameOver", this.createSound("sounds/ranged%20B.wav")); // Generic game sound
        this.sounds.set("weaponSwitch", this.createSound("sounds/ranged%20B.wav")); // Generic weapon sound
        this.sounds.set("reload", this.createSound("sounds/ranged%20B.wav")); // Generic reload sound
        this.sounds.set("ability", this.createSound("sounds/ranged%20S.wav")); // Generic ability sound
        this.sounds.set("pause", this.createSound("sounds/ranged%20B.wav")); // Generic pause sound
        this.sounds.set("resume", this.createSound("sounds/ranged%20B.wav")); // Generic resume sound

        // Class-specific attack sounds
        this.sounds.set("mageAttack", this.createSound("sounds/mage%20B.wav"));
        this.sounds.set("meleeAttack", this.createSound("sounds/melee%20B.wav"));
        this.sounds.set("rangedAttack", this.createSound("sounds/ranged%20B.wav"));
        this.sounds.set("healerAttack", this.createSound("sounds/healer%20B.wav"));

        // Class-specific ability sounds
        this.sounds.set("mageAbility", this.createSound("sounds/mage%20S.wav"));
        this.sounds.set("meleeAbility", this.createSound("sounds/melee%20S.wav"));
        this.sounds.set("rangedAbility", this.createSound("sounds/ranged%20S.wav"));
        this.sounds.set("healerAbility", this.createSound("sounds/healer%20S.wav"));

        // Background music
        this.sounds.set("soundtrack", this.createSound("sounds/soundtrack.mp3"));
    }

    createSound(dataUrl) {
        const audio = new Audio(dataUrl);
        audio.volume = this.volume;
        return audio;
    }

    playSound(soundName) {
        if (this.muted) return;

        const sound = this.sounds.get(soundName);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch((e) => console.log("Sound play failed:", e));
        }
    }

    // Play sound only if game is not paused
    playSoundIfNotPaused(soundName, isPaused) {
        if (this.muted || isPaused) return;

        const sound = this.sounds.get(soundName);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch((e) => console.log("Sound play failed:", e));
        }
    }

    playSoundWithVolume(soundName, volume) {
        if (this.muted) return;

        const sound = this.sounds.get(soundName);
        if (sound) {
            const originalVolume = sound.volume;
            sound.volume = volume;
            sound.currentTime = 0;
            sound.play().catch((e) => console.log("Sound play failed:", e));
            // Restore original volume after playing
            setTimeout(() => {
                sound.volume = originalVolume;
            }, 100);
        }
    }

    // Play class-specific attack sound
    playAttackSound(className, isPaused = false) {
        let soundName;
        switch (className) {
            case "mage":
                soundName = "mageAttack";
                break;
            case "melee":
                soundName = "meleeAttack";
                break;
            case "ranged":
                soundName = "rangedAttack";
                break;
            case "healer":
                soundName = "healerAttack";
                break;
            default:
                soundName = "shoot";
        }
        this.playSoundIfNotPaused(soundName, isPaused);
    }

    // Play class-specific ability sound
    playAbilitySound(className, isPaused = false) {
        let soundName;
        switch (className) {
            case "mage":
                soundName = "mageAbility";
                break;
            case "melee":
                soundName = "meleeAbility";
                break;
            case "ranged":
                soundName = "rangedAbility";
                break;
            case "healer":
                soundName = "healerAbility";
                break;
            default:
                soundName = "ability";
        }

        // Play with reduced volume for mage ability (only if not paused)
        if (className === "mage") {
            if (!isPaused) {
                this.playSoundWithVolume(soundName, this.volume * 0.6); // 60% of normal volume
            }
        } else {
            this.playSoundIfNotPaused(soundName, isPaused);
        }
    }

    // Start background music
    startSoundtrack() {
        if (this.muted || this.soundtrackPlaying) return;

        const soundtrack = this.sounds.get("soundtrack");
        if (soundtrack) {
            soundtrack.loop = true;
            soundtrack.volume = this.volume * 0.2; // Lower volume for background music
            soundtrack.play().catch((e) => console.log("Soundtrack play failed:", e));
            this.soundtrackPlaying = true;
        }
    }

    // Stop background music
    stopSoundtrack() {
        const soundtrack = this.sounds.get("soundtrack");
        if (soundtrack) {
            soundtrack.pause();
            soundtrack.currentTime = 0;
            this.soundtrackPlaying = false;
        }
    }

    // Pause all sounds
    pauseAllSounds() {
        this.sounds.forEach((sound, soundName) => {
            sound.pause(); // Pause all sounds including soundtrack
        });
    }

    // Stop all sounds completely
    stopAllSounds() {
        this.sounds.forEach((sound, soundName) => {
            sound.pause();
            sound.currentTime = 0; // Reset to beginning
        });
        this.soundtrackPlaying = false;
    }

    // Resume all sounds (this doesn't actually resume, but resets for next play)
    resumeAllSounds() {
        this.sounds.forEach((sound, soundName) => {
            if (soundName === "soundtrack") {
                // Resume soundtrack if it was playing before pause
                if (this.soundtrackPlaying) {
                    sound.play().catch((e) => console.log("Soundtrack resume failed:", e));
                }
            } else {
                sound.currentTime = 0; // Reset to beginning for next play
            }
        });
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.sounds.forEach((sound, soundName) => {
            if (soundName === "soundtrack") {
                sound.volume = this.volume * 0.3; // Keep soundtrack at lower volume
            } else {
                sound.volume = this.volume;
            }
        });
    }

    toggleMute() {
        this.muted = !this.muted;
        this.sounds.forEach((sound) => {
            sound.muted = this.muted;
        });

        // If muting, stop soundtrack
        if (this.muted) {
            this.stopSoundtrack();
        }
    }

    // Complete cleanup - stop all sounds and reset state
    cleanup() {
        console.log("SoundManager cleanup - stopping all sounds");
        this.soundtrackPlaying = false;

        this.sounds.forEach((sound, soundName) => {
            sound.pause();
            sound.currentTime = 0;
            sound.loop = false;
        });
    }
}

// Make SoundManager available globally
// @ts-ignore
window.SoundManager = SoundManager;