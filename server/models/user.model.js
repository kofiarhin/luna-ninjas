// server/models/user.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    username: { type: String, default: undefined },
    displayName: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    totalScore: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.index({ totalScore: -1 });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
