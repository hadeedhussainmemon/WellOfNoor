const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    driveId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);
