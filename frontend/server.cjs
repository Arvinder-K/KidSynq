
const express = require("express");
const path = require("path");

const app = express();

// IMPORTANT: Use the port provided by the hosting platform
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, "dist");

// Serve React production files
app.use(express.static(distPath));

// React Router support
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
});

// Listen on the assigned hosting port
app.listen(PORT, "0.0.0.0", () => {
    console.log(`KidSynq running on port ${PORT}`);
});
