const Lobby = require('./Lobby');

class GameManager {
    constructor() {
        this.lobbies = new Map();
        this.players = new Map();
    }

    createLobby(name, hostId) {
        const lobby = new Lobby(name, hostId);
        lobby.setGameManager(this); // Pass GameManager reference
        this.lobbies.set(lobby.id, lobby);
        return lobby;
    }

    getLobby(lobbyId) {
        return this.lobbies.get(lobbyId);
    }

    removeLobby(lobbyId) {
        this.lobbies.delete(lobbyId);
    }

    getPlayer(socketId) {
        return this.players.get(socketId);
    }

    setPlayer(socketId, playerData) {
        this.players.set(socketId, playerData);
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
    }

    getAllLobbies() {
        return Array.from(this.lobbies.values()).map(lobby => ({
            id: lobby.id,
            name: lobby.name,
            playerCount: lobby.players.size,
            maxPlayers: lobby.maxPlayers,
            gameState: lobby.gameState,
            gameMode: lobby.gameMode
        }));
    }

    // Set io instance for all lobbies
    setIO(io) {
        this.io = io;
        this.lobbies.forEach(lobby => lobby.setIO(io));
    }

    // Create a new lobby with io instance
    createLobbyWithIO(name, hostId) {
        const lobby = this.createLobby(name, hostId);
        lobby.setIO(this.io);
        return lobby;
    }

    // Emit lobby list to all clients
    emitLobbyList() {
        if (!this.io) return;

        const lobbyList = this.getAllLobbies();
        this.io.emit("lobbyList", lobbyList);
    }
}

module.exports = GameManager;