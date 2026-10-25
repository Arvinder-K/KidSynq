
const express = require("express");
const path = require("node:path");
const fs = require("node:fs");

const app = express();

// GoDaddy provides the PORT environment variable
const PORT = process.env.PORT || 3000;

// React production build location
const distPath = path.join(__dirname, "frontend", "dist");

// Check whether the React build exists
if (!fs.existsSync(path.join(distPath, "index.html"))) {
    console.error("React build not found. Run npm run build first.");
    process.exit(1);
}

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        application: "KidSynq"
    });
});

// Serve React static files
app.use(express.static(distPath));

// React Router fallback
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
});

// Start production server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`KidSynq production server running on port ${PORT}`);
});
