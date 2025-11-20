// Game State Manager
class GameStateManager {
    constructor(isRunning, isPaused, updateGameStatus, soundManager, showGameEndScreen, showWinnerScreen, showLobbyScreen) {
        this.isRunning = isRunning;
        this.isPaused = isPaused;
        this.updateGameStatus = updateGameStatus;
        this.soundManager = soundManager;
        this.showGameEndScreen = showGameEndScreen;
        this.showWinnerScreen = showWinnerScreen;
        this.showLobbyScreen = showLobbyScreen;
    }

    pauseGame(pausedBy) {
        this.isPaused = true;
        this.updateGameStatus(`Paused by ${pausedBy}`);
        this.soundManager.playSound("pause");
        this.soundManager.pauseAllSounds();
    }

    resumeGame(resumedBy) {
        this.isPaused = false;
        this.updateGameStatus(`Resumed by ${resumedBy}`);
        this.soundManager.playSound("resume");
        this.soundManager.resumeAllSounds();
    }

    quitGame(quitBy) {
        this.isRunning = false;
        this.updateGameStatus(`Game quit by ${quitBy}`);
        this.soundManager.playSound("gameOver");

        // Show game end screen
        this.showGameEndScreen();
    }

    restartGame(restartedBy) {
        this.isRunning = false;
        this.isPaused = false;
        this.updateGameStatus(`Game restarted by ${restartedBy}`);
        this.soundManager.playSound("gameStart");

        // Show lobby screen (game will restart from lobby)
        this.showLobbyScreen();
    }

    endGame(winner) {
        this.isRunning = false;
        this.updateGameStatus("Game Over");
        this.soundManager.playSound("gameOver");

        // Show winner
        this.showWinnerScreen(winner);
    }

    // Update references when GameEngine properties change
    updateReferences(isRunning, isPaused, updateGameStatus, soundManager, showGameEndScreen, showWinnerScreen, showLobbyScreen) {
        this.isRunning = isRunning;
        this.isPaused = isPaused;
        this.updateGameStatus = updateGameStatus;
        this.soundManager = soundManager;
        this.showGameEndScreen = showGameEndScreen;
        this.showWinnerScreen = showWinnerScreen;
        this.showLobbyScreen = showLobbyScreen;
    }
}

// Make GameStateManager available globally
// @ts-ignore
window.GameStateManager = GameStateManager;