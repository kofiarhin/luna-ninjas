// server/models/user.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    displayName: { type: String, default: "" },
    totalScore: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.index({ totalScore: -1 });

module.exports = mongoose.model("User", userSchema);
