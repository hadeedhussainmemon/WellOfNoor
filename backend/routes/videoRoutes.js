const express = require("express");
const Video = require("../models/Video");

const router = express.Router();

// Add new video (Admin panel se call hogi)
router.post("/", async (req, res) => {
  try {
    const { title, description, url } = req.body;
    const newVideo = new Video({ title, description, url });
    await newVideo.save();
    res.json(newVideo);
  } catch (err) {
    res.status(500).json({ error: "Error saving video" });
  }
});

// Get random videos
router.get("/random", async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    const videos = await Video.aggregate([{ $sample: { size: count } }]);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: "Error fetching videos" });
  }
});

module.exports = router;
