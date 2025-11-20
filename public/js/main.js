// Main Application
class MultiplayerShooterApp {
    constructor() {
        this.socket = null;
        this.gameEngine = null;
        this.currentPage = "home";
        this.playerName = "";
        this.currentLobbyId = null;
        this.isHost = false;
        this.chosenClass = null;
        this.gameEndedByQuit = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectToServer();
        this.showPage("home");
    }

    setupEventListeners() {
        try {

            // Home page events
            document.getElementById("createLobbyBtn").addEventListener("click", () => {
                this.createLobby();
            });

            document
                .getElementById("refreshLobbiesBtn")
                .addEventListener("click", () => {
                    this.refreshLobbies();
                });

            // Lobby page events
            document.getElementById("startGameBtn").addEventListener("click", () => {
                this.startGame();
            });

            document.getElementById("leaveLobbyBtn").addEventListener("click", () => {
                this.leaveLobby();
            });

            // Game mode selection events
            document.querySelectorAll('.game-mode-card').forEach(card => {
                card.addEventListener('click', () => {
                    if (this.isHost) {
                        const mode = card.getAttribute('data-mode');
                        this.changeGameMode(mode);
                    }
                });
            });

            // Game page events
            document.getElementById("pauseBtn").addEventListener("click", () => {
                this.togglePause();
            });

            document.getElementById("quitBtn").addEventListener("click", () => {
                this.quitGame();
            });

            document.getElementById("restartGameBtnMain").addEventListener("click", () => {
                this.restartGame();
            });

            document.getElementById("resumeBtn").addEventListener("click", () => {
                this.resumeGame();
            });

            document.getElementById("quitGameBtn").addEventListener("click", () => {
                this.quitGame();
            });


            // Game end events
            document.getElementById("backToLobbyBtn").addEventListener("click", () => {
                this.backToLobby();
            });

            // Error modal events
            document.getElementById("errorCloseBtn").addEventListener("click", () => {
                this.hideError();
            });

            // Player name input events
            const playerNameInput = document.getElementById("playerName");
            playerNameInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    this.createLobby();
                }
            });

            // Update playerName whenever input changes
            playerNameInput.addEventListener("input", (e) => {
                // @ts-ignore
                this.playerName = (e.target).value.trim();
            });
        } catch (error) {
            console.error("Error in setupEventListeners:", error);
        }
    }

    connectToServer() {
        // @ts-ignore
        this.socket = io();

        this.socket.on("connect", () => {
            console.log("Connected to server");
            this.refreshLobbies();
        });

        this.socket.on("disconnect", () => {
            console.log("Disconnected from server");
            this.showError("Lost connection to server");
        });

        this.socket.on("connect_error", (error) => {
            console.error("Connection error:", error);
            this.showError("Failed to connect to server");
        });

        // Lobby events
        this.socket.on("lobbyCreated", (data) => {
            console.log("Received lobbyCreated event:", data);
            if (data.success) {
                this.currentLobbyId = data.lobbyId;
                this.isHost = true;
                this.showPage("lobby");
                this.updateLobbyName(data.lobbyName);
                if (data.gameMode) {
                    this.updateGameModeSelection(data.gameMode);
                }
                console.log("Lobby created successfully, moved to lobby page");
            } else {
                this.showError("Failed to create lobby");
                console.log("Failed to create lobby:", data);
            }
        });

        this.socket.on("joinedLobby", (data) => {
            if (data.success) {
                this.currentLobbyId = data.lobbyId;
                this.isHost = false;
                this.showPage("lobby");
                // Game mode will be updated when lobbyUpdate is received
            } else {
                this.showError(data.message || "Failed to join lobby");
            }
        });

        this.socket.on("lobbyUpdate", (data) => {
            // Check if game was restarted (gameState changed from playing to waiting)
            if (data.gameState === "waiting" && this.currentPage === "game") {
                // Properly clean up the game engine
                if (this.gameEngine) {
                    this.gameEngine.stopGameLoop();
                    // Clear all DOM elements from the game area
                    if (this.gameEngine.renderer) {
                        this.gameEngine.renderer.clear();
                    }
                    this.gameEngine = null;
                }

                // Clear the game area completely
                const gameArea = document.getElementById("gameArea");
                if (gameArea) {
                    gameArea.innerHTML = '';
                }

                // If game ended by quit, refresh the page; otherwise go to lobby
                if (this.gameEndedByQuit) {
                    console.log("Game ended by quit, refreshing page");
                    window.location.href = window.location.href;
                } else {
                    console.log("Game restarted, returning to lobby");
                    this.showPage("lobby");
                }
            }

            this.updateLobbyInfo(data);
            // Disable start unless all players picked a class
            const startGameBtn = document.getElementById("startGameBtn");
            if (startGameBtn && Array.isArray(data.players)) {
                const everyonePicked = data.players.every((p) => !!p.chosenClass);
                // @ts-ignore
                (startGameBtn).disabled =
                    data.players.length < 2 || !everyonePicked || !this.isHost;
            }
        });

        this.socket.on("lobbyList", (data) => {
            this.updateLobbiesList(data);
        });

        // Game events
        this.socket.on("gameStarted", (data) => {
            this.startGameSession(data);
        });

        this.socket.on("gamePaused", (data) => {
            this.showGameMenu(
                "Game Paused",
                `The game has been paused by ${data.pausedBy}`
            );
            if (this.gameEngine) this.gameEngine.isPaused = true;
        });

        this.socket.on("gameResumed", (data) => {
            this.hideGameMenu();
            if (this.gameEngine) this.gameEngine.isPaused = false;
        });

        this.socket.on("gameQuit", (data) => {
            console.log("Received gameQuit event:", data);
            this.gameEndedByQuit = true;

            // Stop all music and sounds
            if (this.gameEngine && this.gameEngine.soundManager) {
                this.gameEngine.soundManager.stopAllSounds();
            }

            // Show immediate quit notification
            this.showQuitNotification(data.quitBy);

            // Show game end screen with quit info
            this.showGameEndScreen(null, { quitBy: data.quitBy });
        });

        this.socket.on("gameRestarted", (data) => {
            this.gameEndedByQuit = false; // Reset quit flag on restart
            this.showGameMenu(
                "Game Restarted",
                `${data.restartedBy} restarted the game`
            );
        });


        this.socket.on("lobbyDeleted", (data) => {
            console.log("Lobby deleted:", data.message);
            // Refresh the page when lobby is deleted
            window.location.href = window.location.href;
        });
    }

    restorePlayerName() {
        // Restore player name in input field if we have one saved
        if (this.playerName) {
            const playerNameInput = document.getElementById("playerName");
            if (playerNameInput) {
                // @ts-ignore
                playerNameInput.value = this.playerName;
            }
        }
    }

    createLobby() {
        const playerNameInput = document.getElementById("playerName");
        // @ts-ignore
        this.playerName = (playerNameInput).value.trim();

        if (!this.playerName) {
            this.showError("Please enter your name");
            return;
        }

        if (this.playerName.length < 2) {
            this.showError("Name must be at least 2 characters long");
            return;
        }

        console.log("Creating lobby with player name:", this.playerName);
        console.log("Socket connected:", this.socket && this.socket.connected);

        this.showLoading(true);
        this.socket.emit("createLobby", { playerName: this.playerName });
    }

    joinLobby(lobbyId) {
        console.log("Attempting to join lobby:", lobbyId);
        console.log("Current playerName:", this.playerName);
        console.log(
            "Player name input value:",
            // @ts-ignore
            (document.getElementById("playerName")).value
        );

        if (!this.playerName) {
            this.showError("Please enter your name first");
            return;
        }

        this.showLoading(true);
        this.socket.emit("joinLobby", {
            lobbyId: lobbyId,
            playerName: this.playerName,
        });
    }

    startGame() {
        if (this.currentLobbyId && this.isHost) {
            this.socket.emit("startGame", { lobbyId: this.currentLobbyId });
        }
    }

    leaveLobby() {
        if (this.currentLobbyId) {
            this.socket.emit("leaveLobby", { lobbyId: this.currentLobbyId });
            this.currentLobbyId = null;
            this.isHost = false;
            this.showPage("home");
        }
    }

    changeGameMode(gameMode) {
        if (this.currentLobbyId && this.isHost) {
            this.socket.emit("changeGameMode", {
                lobbyId: this.currentLobbyId,
                gameMode: gameMode
            });
        }
    }

    startGameSession(data) {

        // Ensure we have a clean game area
        const gameArea = document.getElementById("gameArea");
        if (gameArea) {
            gameArea.innerHTML = ''; // Clear any existing content
        }

        this.showPage("game");

        // Store game mode for future use
        this.currentGameMode = data.gameMode || "survival";


        this.gameEngine = new GameEngine(gameArea, this.socket, this.currentGameMode, data.gameStartTime);
        // Provide lobby id for server-side ability events
        this.gameEngine.currentLobbyId = this.currentLobbyId;

        // Set game state since we're not waiting for the gameStarted event anymore
        this.gameEngine.isRunning = true;
        this.gameEngine.isPaused = false;

        // Start the game loop
        this.gameEngine.startGameLoop();


        // Find the local player in the players array
        const localPlayer = data.players.find(
            (player) => player.id === this.socket.id
        );
        if (localPlayer) {
            this.gameEngine.setLocalPlayerId(this.socket.id);
        }

        // Initialize players
        data.players.forEach((playerData) => {
            this.gameEngine.addPlayer(
                playerData.id,
                playerData.name,
                playerData.x,
                playerData.y
            );
            const ply = this.gameEngine.players.get(playerData.id);
            if (ply && playerData.chosenClass) {
                ply.className = playerData.chosenClass;
                // Equip default weapon per class
                switch (ply.className) {
                    case "healer":
                        ply.currentWeapon = "healerStaff";
                        break;
                    case "mage":
                        ply.currentWeapon = "mageBolt";
                        break;
                    case "ranged":
                        ply.currentWeapon = "arrow";
                        break;
                    case "melee":
                        ply.currentWeapon = "meleeStrike";
                        break;
                }
            }
        });

        // Update UI
        this.updateGameUI();

        // Ensure scoreboard updates after a short delay to catch all player data
        setTimeout(() => {
            if (this.gameEngine) {
                this.gameEngine.updateScoreboard();
            }
        }, 100);

        // Play game start sound and update game status
        if (this.gameEngine.soundManager) {
            this.gameEngine.soundManager.playSound("gameStart");
            // Start background soundtrack for survival and deathmatch modes
            this.gameEngine.soundManager.startSoundtrack();
        }
        this.gameEngine.updateGameStatus("Playing");
        this.gameEngine.updateLivesCounter();
    }

    togglePause() {
        // Server-authoritative pause
        if (this.currentLobbyId) {
            this.socket.emit("togglePause", { lobbyId: this.currentLobbyId });
        }
    }

    resumeGame() {
        // Server-authoritative resume
        if (this.currentLobbyId) {
            this.socket.emit("togglePause", { lobbyId: this.currentLobbyId });
        }
    }

    quitGame() {
        if (this.currentLobbyId) {
            this.socket.emit("quitGame", { lobbyId: this.currentLobbyId });
        }
    }

    restartGame() {
        if (this.currentLobbyId && this.socket && this.socket.connected) {

            // Hide any open menus to avoid conflicts
            this.hideGameMenu();

            // Send restart request to server
            try {
                this.socket.emit("restartGame", {
                    lobbyId: this.currentLobbyId
                });
            } catch (error) {
                console.error("Error sending restart request:", error);
            }
        }
    }

    backToLobby() {
        location.reload();
    }

    refreshLobbies() {
        if (this.socket && this.socket.connected) {
            this.socket.emit("getLobbies");
        }
    }

    updateLobbiesList(lobbies) {
        const lobbiesList = document.getElementById("lobbiesList");
        if (!lobbiesList) return;

        if (lobbies.length === 0) {
            lobbiesList.innerHTML =
                "<p>No lobbies available. Create one to get started!</p>";
            return;
        }

        lobbiesList.innerHTML = lobbies
            .map(
                (lobby, index) => `
            <div class="lobby-card" data-lobby-id="${lobby.id}">
                <h4>${lobby.name}</h4>
                <p>Players: ${lobby.playerCount}/${lobby.maxPlayers}</p>
                <p>Status: <span class="status ${lobby.gameState}">${lobby.gameState}</span></p>
                <p>Game Mode: <span class="game-mode">${lobby.gameMode ? lobby.gameMode.charAt(0).toUpperCase() + lobby.gameMode.slice(1) : 'Survival'}</span></p>
            </div>
        `
            )
            .join("");

        // Add click event listeners to lobby cards
        const lobbyCards = lobbiesList.querySelectorAll(".lobby-card");
        lobbyCards.forEach((card) => {
            card.addEventListener("click", () => {
                const lobbyId = card.getAttribute("data-lobby-id");
                this.joinLobby(lobbyId);
            });
        });
    }

    updateLobbyInfo(data) {
        // Update player count
        const playerCountElement = document.getElementById("playerCount");
        if (playerCountElement) {
            playerCountElement.textContent = `${data.players.length}/4`;
        }

        // Update game mode display
        if (data.gameMode) {
            const gameModeDisplay = document.getElementById("gameModeDisplay");
            if (gameModeDisplay) {
                gameModeDisplay.textContent = data.gameMode.charAt(0).toUpperCase() + data.gameMode.slice(1);
            }

            // Update game mode selection UI
            this.updateGameModeSelection(data.gameMode);
        }

        // Update players list
        const playersListElement = document.getElementById("playersList");
        if (playersListElement) {
            playersListElement.innerHTML = data.players
                .map(
                    (player) => `
                <div class="player-item">
                    <span class="player-name">${player.name}</span>
                    <span class="player-host">${
                      player.id === this.socket.id ? "You" : "Player"
                    }</span>
                </div>
            `
                )
                .join("");
        }

        // Update start button
        const startGameBtn = document.getElementById("startGameBtn");
        if (startGameBtn) {
            // @ts-ignore
            (startGameBtn).disabled = data.players.length < 2 || !this.isHost;
        }

        // Update lobby status
        const lobbyStatusElement = document.getElementById("lobbyStatus");
        if (lobbyStatusElement) {
            switch (data.gameState) {
                case "waiting":
                    lobbyStatusElement.textContent = "Waiting for players...";
                    break;
                case "playing":
                    lobbyStatusElement.textContent = "Game in progress";
                    break;
                case "paused":
                    lobbyStatusElement.textContent = "Game paused";
                    break;
                case "finished":
                    lobbyStatusElement.textContent = "Game finished";
                    break;
            }
        }
    }

    updateLobbyName(name) {
        const lobbyNameElement = document.getElementById("lobbyName");
        if (lobbyNameElement) {
            lobbyNameElement.textContent = name;
        }
    }

    updateGameModeSelection(selectedMode) {
        // Remove selected class from all game mode cards
        document.querySelectorAll('.game-mode-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Add selected class to the current game mode
        const selectedCard = document.querySelector(`[data-mode="${selectedMode}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        // Update status text
        const gameModeStatus = document.getElementById("gameModeStatus");
        if (gameModeStatus) {
            gameModeStatus.textContent = `Current: ${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)}`;
        }

        // Show/hide game mode selection based on host status
        const gameModeSelect = document.getElementById("gameModeSelect");
        if (gameModeSelect) {
            if (this.isHost) {
                gameModeSelect.classList.remove('hidden');
            } else {
                gameModeSelect.classList.add('hidden');
            }
        }
    }

    updateGameUI() {
        // Update scoreboard
        if (this.gameEngine) {
            this.gameEngine.updateScoreboard();
        }
    }

    showGameMenu(title, message) {
        const gameMenu = document.getElementById("gameMenu");
        const menuTitle = document.getElementById("menuTitle");
        const menuMessage = document.getElementById("menuMessage");
        const menuButtons = document.querySelector('.menu-buttons');


        if (gameMenu && menuTitle && menuMessage) {
            menuTitle.textContent = title;
            menuMessage.textContent = message;

            // Ensure all buttons are visible
            const resumeBtn = document.getElementById("resumeBtn");
            const quitGameBtn = document.getElementById("quitGameBtn");

            if (resumeBtn) resumeBtn.style.display = "block";
            if (quitGameBtn) quitGameBtn.style.display = "block";

            gameMenu.classList.remove("hidden");
        }
    }

    hideGameMenu() {
        const gameMenu = document.getElementById("gameMenu");
        if (gameMenu) {
            gameMenu.classList.add("hidden");

            // Reset button visibility
            const resumeBtn = document.getElementById("resumeBtn");
            const quitGameBtn = document.getElementById("quitGameBtn");

            if (resumeBtn) resumeBtn.style.display = "";
            if (quitGameBtn) quitGameBtn.style.display = "";
        }
    }

    showQuitNotification(quitBy) {
        // Remove existing notification if present
        let existingNotification = document.getElementById("quitNotification");
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create quit notification overlay - smaller and positioned above game over screen
        const notification = document.createElement("div");
        notification.id = "quitNotification";
        notification.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 71, 87, 0.95);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            border: 2px solid #ff4757;
            font-size: 1.2rem;
            font-weight: bold;
            z-index: 3000;
            box-shadow: 0 4px 16px rgba(0,0,0,0.6);
            text-align: center;
            max-width: 400px;
            word-wrap: break-word;
        `;

        notification.innerHTML = `
            <div>${quitBy} quit the game</div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    showGameEndScreen(winner, quitInfo = null) {
        const gameEndOverlay = document.getElementById("gameEndOverlay");
        const winnerInfo = document.getElementById("winnerInfo");
        const finalScoresList = document.getElementById("finalScoresList");

        if (gameEndOverlay && winnerInfo && finalScoresList) {
            if (quitInfo) {
                winnerInfo.innerHTML = `
                    <h4>🚪 Game Quit</h4>
                    <p>${quitInfo.quitBy} quit the game</p>
                `;
            } else if (winner) {
                winnerInfo.innerHTML = `
                    <h4>🏆 Winner!</h4>
                    <p>${winner.name} wins with ${winner.score} points!</p>
                `;
            } else {
                winnerInfo.innerHTML = `
                    <h4>🎮 Game Over</h4>
                    <p>The game has ended</p>
                `;
            }

            if (this.gameEngine) {
                const players = Array.from(this.gameEngine.players.values());
                players.sort((a, b) => b.score - a.score);

                finalScoresList.innerHTML = players
                    .map(
                        (player) => `
                    <div class="final-score-item">
                        <span>${player.name}</span>
                        <span>${player.score} pts (${player.kills} kills, ${player.deaths} deaths)</span>
                    </div>
                `
                    )
                    .join("");
            }

            gameEndOverlay.classList.remove("hidden");
        }
    }

    hideGameEndScreen() {
        const gameEndOverlay = document.getElementById("gameEndOverlay");
        if (gameEndOverlay) {
            gameEndOverlay.classList.add("hidden");
        }
    }

    showPage(pageName) {
        // Hide all pages
        document.querySelectorAll(".page").forEach((page) => {
            page.classList.remove("active");
        });

        // Show selected page
        const targetPage = document.getElementById(pageName + "Page");
        if (targetPage) {
            targetPage.classList.add("active");
            this.currentPage = pageName;
        }

        // Hide loading overlay
        this.showLoading(false);

        // Attach lobby class card handlers when lobby becomes active
        if (pageName === "lobby") {
            const classCards = document.querySelectorAll(".class-card");
            const classStatus = document.getElementById("classStatus");
            if (classCards && classCards.length) {
                classCards.forEach((card) => {
                    card.addEventListener("click", () => {
                        classCards.forEach((c) => c.classList.remove("selected"));
                        card.classList.add("selected");
                        this.chosenClass = card.getAttribute("data-class");
                        if (classStatus)
                            classStatus.textContent = `Selected: ${this.chosenClass}`;
                        if (this.currentLobbyId) {
                            this.socket.emit("chooseClass", {
                                lobbyId: this.currentLobbyId,
                                className: this.chosenClass,
                            });
                        }
                    });
                });
            }
        }
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById("loadingOverlay");
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.classList.remove("hidden");
            } else {
                loadingOverlay.classList.add("hidden");
            }
        }
    }

    showError(message) {
        const errorModal = document.getElementById("errorModal");
        const errorMessage = document.getElementById("errorMessage");

        if (errorModal && errorMessage) {
            errorMessage.textContent = message;
            errorModal.classList.remove("hidden");
        }

        this.showLoading(false);
    }

    hideError() {
        const errorModal = document.getElementById("errorModal");
        if (errorModal) {
            errorModal.classList.add("hidden");
        }
    }

    // Utility functions
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
}

// Global app instance
let app;

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    app = new MultiplayerShooterApp();
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Page is hidden, pause game if running
        if (app && app.gameEngine && app.gameEngine.isRunning) {
            // Could implement auto-pause here
        }
    }
});

// Handle window resize
window.addEventListener("resize", () => {
    if (app && app.gameEngine) {
        // Could implement responsive game area resizing here
    }
});

// Handle beforeunload
window.addEventListener("beforeunload", (e) => {
    if (app && app.gameEngine && app.gameEngine.isRunning) {
        // Warn user about leaving during game
        e.preventDefault();
        e.returnValue = "Are you sure you want to leave? The game will end.";
    }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
    // Escape key to pause/resume game
    if (e.key === "Escape" && app && app.gameEngine && app.gameEngine.isRunning) {
        if (app.gameEngine.isPaused) {
            app.resumeGame();
        } else {
            app.togglePause();
        }
    }

    // F11 for fullscreen
    if (e.key === "F11") {
        e.preventDefault();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
});

// Performance monitoring
if ("performance" in window) {
    // Monitor frame rate
    let frameCount = 0;
    let lastTime = performance.now();

    function monitorPerformance() {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            console.log(`Current FPS: ${fps}`);

            if (fps < 50) {
                console.warn(
                    "Low frame rate detected. Consider optimizing game performance."
                );
            }

            frameCount = 0;
            lastTime = currentTime;
        }

        requestAnimationFrame(monitorPerformance);
    }

    // Start monitoring after a delay
    setTimeout(() => {
        if (app && app.gameEngine) {
            requestAnimationFrame(monitorPerformance);
        }
    }, 5000);
}

// Make MultiplayerShooterApp available globally
// @ts-ignore
window.MultiplayerShooterApp = MultiplayerShooterApp;