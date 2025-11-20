const { normalizeWeapon } = require('../utils/weaponUtils');

function setupLobbyHandlers(socket, gameManager, io) {
    // Join lobby
    socket.on("joinLobby", (data) => {
        const { lobbyId, playerName } = data;
        const lobby = gameManager.getLobby(lobbyId);

        if (lobby && lobby.players.size < lobby.maxPlayers) {
            const addResult = lobby.addPlayer(socket.id, playerName);
            if (addResult && addResult.error) {
                socket.emit("joinedLobby", {
                    success: false,
                    message: addResult.error,
                });
                return;
            }
            if (addResult === false) {
                socket.emit("joinedLobby", {
                    success: false,
                    message: "Lobby is full",
                });
                return;
            }
            socket.join(lobbyId);
            gameManager.setPlayer(socket.id, { lobbyId, playerName });

            socket.emit("joinedLobby", {
                success: true,
                lobbyId: lobby.id,
                players: Array.from(lobby.players.values()),
                gameState: lobby.gameState,
                gameStartTime: lobby.gameStartTime,
                gameMode: lobby.gameMode,
            });

            // Notify other players in lobby
            socket.to(lobbyId).emit("playerJoined", {
                player: lobby.players.get(socket.id),
            });

            // Emit updated lobby info
            io.to(lobbyId).emit("lobbyUpdate", {
                players: Array.from(lobby.players.values()),
                gameState: lobby.gameState,
                gameStartTime: lobby.gameStartTime,
                gameMode: lobby.gameMode,
            });
        } else {
            socket.emit("joinedLobby", {
                success: false,
                message: "Lobby not found or full",
            });
        }
    });

    // Create lobby
    socket.on("createLobby", (data) => {
        const { playerName } = data;
        const lobby = gameManager.createLobbyWithIO(`${playerName}'s Lobby`, socket.id);

        socket.join(lobby.id);
        lobby.addPlayer(socket.id, playerName);
        gameManager.setPlayer(socket.id, { lobbyId: lobby.id, playerName });

        socket.emit("lobbyCreated", {
            success: true,
            lobbyId: lobby.id,
            lobbyName: lobby.name,
            gameMode: lobby.gameMode,
        });

        // Emit updated lobby list to all clients
        gameManager.emitLobbyList();
    });

    // Leave lobby
    socket.on("leaveLobby", (data) => {
        const { lobbyId } = data || {};
        const lobby = gameManager.getLobby(lobbyId);
        const playerData = gameManager.getPlayer(socket.id);

        if (lobby && playerData) {
            lobby.removePlayer(socket.id);
            socket.leave(lobbyId);
            gameManager.removePlayer(socket.id);

            // Notify other players
            socket.to(lobbyId).emit("playerLeft", {
                playerId: socket.id,
                players: Array.from(lobby.players.values()),
            });

            // Emit updated lobby info
            io.to(lobbyId).emit("lobbyUpdate", {
                players: Array.from(lobby.players.values()),
                gameState: lobby.gameState,
                gameStartTime: lobby.gameStartTime,
                gameMode: lobby.gameMode,
            });

            // If lobby is empty, remove it
            if (lobby.players.size === 0) {
                gameManager.removeLobby(lobbyId);
                // Emit updated lobby list when lobby is removed
                gameManager.emitLobbyList();
            }
        }
    });

    // Start game
    socket.on("startGame", (data) => {
        const { lobbyId } = data;
        const lobby = gameManager.getLobby(lobbyId);
        const playerData = gameManager.getPlayer(socket.id);

        if (lobby && playerData && lobby.hostId === socket.id) {
            if (lobby.startGame()) {
                io.to(lobbyId).emit("gameStarted", {
                    gameStartTime: lobby.gameStartTime,
                    players: Array.from(lobby.players.values()),
                    gameMode: lobby.gameMode,
                });
            } else {
                socket.emit("gameStartFailed", {
                    message: "Cannot start game. Need at least 2 players and all must choose a class.",
                });
            }
        }
    });

    // Choose class
    socket.on("chooseClass", (data) => {
        const { lobbyId, className } = data;
        const lobby = gameManager.getLobby(lobbyId);
        const playerData = gameManager.getPlayer(socket.id);

        if (lobby && playerData) {
            const player = lobby.players.get(socket.id);
            if (player) {
                player.chosenClass = className;

                // Normalize weapon for this class
                const weaponKey = lobby.inferWeaponKeyFromClass(className);
                const weaponObj = {}; // Default weapon object
                player.weapon = normalizeWeapon(weaponKey, weaponObj, className);
                player.weaponKey = weaponKey;


                // Notify all players in lobby
                io.to(lobbyId).emit("classChosen", {
                    playerId: socket.id,
                    className: className,
                    players: Array.from(lobby.players.values()),
                });

                // Emit updated lobby info
                io.to(lobbyId).emit("lobbyUpdate", {
                    players: Array.from(lobby.players.values()),
                    gameState: lobby.gameState,
                    gameStartTime: lobby.gameStartTime,
                    gameMode: lobby.gameMode,
                });
            }
        }
    });

    // Change game mode
    socket.on("changeGameMode", (data) => {
        const { lobbyId, gameMode } = data;
        const lobby = gameManager.getLobby(lobbyId);
        const playerData = gameManager.getPlayer(socket.id);

        if (lobby && playerData && lobby.hostId === socket.id) {
            if (lobby.setGameMode(gameMode)) {
                io.to(lobbyId).emit("gameModeChanged", {
                    gameMode: gameMode,
                });

                // Emit updated lobby info
                io.to(lobbyId).emit("lobbyUpdate", {
                    players: Array.from(lobby.players.values()),
                    gameState: lobby.gameState,
                    gameStartTime: lobby.gameStartTime,
                    gameMode: lobby.gameMode,
                });
            }
        }
    });

    // Get lobbies
    socket.on("getLobbies", () => {
        gameManager.emitLobbyList();
    });
}

module.exports = { setupLobbyHandlers };