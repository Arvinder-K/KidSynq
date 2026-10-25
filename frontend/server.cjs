
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, "dist");

// Serve static React files
app.use(express.static(distPath));

// React Router fallback
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`KidSynq frontend running on port ${PORT}`);
});
