// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Video = require("./models/Video"); // ensure models/Video.js exists

const app = express();

// --- Middleware ---
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// --- Config / env ---
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/shortsdb";
const JWT_SECRET = process.env.JWT_SECRET || "change_this_jwt_secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "4h"; // token expiry
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "password123"; // plain in env (will be hashed on startup)
const SALT_ROUNDS = 10;

// Hash admin password on startup (so we compare using bcrypt.compare)
let ADMIN_PASS_HASH;
(async () => {
  try {
    ADMIN_PASS_HASH = await bcrypt.hash(ADMIN_PASS, SALT_ROUNDS);
    console.log("Admin password hashed in-memory.");
  } catch (err) {
    console.error("Error hashing admin password:", err);
    process.exit(1);
  }
})();

// --- Connect to MongoDB ---
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// --- Helpers ---
function driveLinkFromId(id) {
  // Returns Google Drive link that commonly works for <video> src
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

// JWT middleware to protect admin routes
function requireAuth(req, res, next) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "No authorization header" });

  const parts = authHeader.split(" ");
  const token = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : null;
  if (!token)
    return res.status(401).json({ error: "Malformed authorization header" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// Simple rate-limiter placeholder (you can replace with express-rate-limit)
function simpleRateLimit(req, res, next) {
  // Placeholder — in production use a proper rate limiter
  next();
}

// --- Routes ---

// Health
app.get("/api/ping", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Admin login
// POST { username, password } -> { token }
app.post("/api/admin/login", simpleRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });

    if (username !== ADMIN_USER)
      return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, ADMIN_PASS_HASH);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ user: username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });
    return res.json({ token, expiresIn: JWT_EXPIRES });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Protected: Add video
// POST { title, description, driveId, tags? }
app.post("/api/admin/videos", requireAuth, async (req, res) => {
  try {
    const { title = "", description = "", driveId, tags = [] } = req.body;
    if (!driveId) return res.status(400).json({ error: "driveId required" });

    // Simple validation: driveId should be a non-empty string
    if (typeof driveId !== "string" || driveId.trim() === "")
      return res.status(400).json({ error: "Invalid driveId" });

    const v = new Video({
      title: String(title).trim(),
      description: String(description).trim(),
      driveId: driveId.trim(),
      tags: Array.isArray(tags) ? tags.map(String) : [],
    });
    await v.save();

    return res.json({
      success: true,
      video: {
        id: v._id,
        title: v.title,
        description: v.description,
        url: driveLinkFromId(v.driveId),
        createdAt: v.createdAt,
      },
    });
  } catch (err) {
    console.error("Add video error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Get video count
app.get("/api/videos/count", async (req, res) => {
  try {
    const count = await Video.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error("Count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get random videos
// GET /api/videos/random?count=20
app.get("/api/videos/random", async (req, res) => {
  try {
    const qCount = Number(req.query.count) || 20;
    const count = Math.max(1, Math.min(200, qCount));
    const docs = await Video.aggregate([{ $sample: { size: count } }]);
    const out = docs.map((d) => ({
      id: d._id,
      title: d.title,
      description: d.description,
      tags: d.tags,
      url: driveLinkFromId(d.driveId),
    }));
    res.json(out);
  } catch (err) {
    console.error("Random videos error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Optional: list videos (admin only) - handy for admin UI to show existing items
app.get("/api/admin/videos", requireAuth, async (req, res) => {
  try {
    const docs = await Video.find().sort({ createdAt: -1 }).limit(500).lean();
    const out = docs.map((d) => ({
      id: d._id,
      title: d.title,
      description: d.description,
      tags: d.tags,
      url: driveLinkFromId(d.driveId),
      createdAt: d.createdAt,
    }));
    res.json(out);
  } catch (err) {
    console.error("Admin list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Optional: Serve static admin + frontend from same server (uncomment if you want)
// Put your admin.html in ./public/admin.html and frontend index in ./public/index.html
// app.use(express.static(path.join(__dirname, 'public')));
// app.get('/', (req,res) => res.sendFile(path.join(__dirname, 'public','index.html')));

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(
    `API endpoints: /api/ping  /api/videos/random  /api/admin/login  /api/admin/videos`
  );
});
