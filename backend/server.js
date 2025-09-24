const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.get("/api/ping", (req, res) => res.json({ msg: "pong" }));
app.use("/api/videos", require("./routes/videoRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// DB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("Mongo Error", err));

// ❌ Do not use app.listen (Vercel handles server)
// ✅ Export app for Vercel
module.exports = app;
