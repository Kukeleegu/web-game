// Game Configuration - only static values that were in the original server.js
module.exports = {
    // Server settings
    PORT: process.env.PORT || 3000,

    // CORS settings
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },

    // Game settings that were hardcoded in the original
    maxPlayers: 4,
    gameDuration: {
        survival: 900000, // 15 minutes
        deathmatch: 300000 // 5 minutes
    },
    worldSize: {
        width: 1200,
        height: 800
    }
};