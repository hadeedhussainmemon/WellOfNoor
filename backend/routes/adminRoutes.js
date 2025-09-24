const express = require("express");
const router = express.Router();
const Video = require("../models/Video");
const jwt = require("jsonwebtoken");

// Middleware for authentication
function auth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token expired/invalid" });
  }
}

// ✅ Update video by ID
router.put("/videos/:id", auth, async (req, res) => {
  try {
    const { title, description, driveId } = req.body;

    const updated = await Video.findByIdAndUpdate(
      req.params.id,
      { title, description, driveId },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: "Video not found" });
    }

    res.json({ success: true, video: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
