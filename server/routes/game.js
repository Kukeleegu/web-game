const express = require("express");
const path = require("path");

const router = express.Router();

// Serve static files
router.use(express.static("public"));

// Serve Socket.IO client
router.get("/socket.io/socket.io.js", (req, res) => {
    try {
        const clientPath = require.resolve("socket.io/client-dist/socket.io.js");
        res.sendFile(clientPath);
    } catch (e) {
        res.status(404).end();
    }
});

// Handle favicon requests
router.get("/favicon.ico", (req, res) => {
    res.status(204).end(); // No content, but no error
});

// Serve main page
router.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../../public/index.html"));
});

// API routes
router.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
});

router.get("/api/lobbies", (req, res) => {
    // This would be implemented with the game manager
    res.json({ lobbies: [] });
});

module.exports = router;