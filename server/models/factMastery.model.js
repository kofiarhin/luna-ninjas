const mongoose = require("mongoose");

const factMasterySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    factA: { type: Number, required: true },
    factB: { type: Number, required: true },
    operation: {
      type: String,
      enum: ["multiplication", "division"],
      default: "multiplication",
      required: true,
    },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

factMasterySchema.index(
  { userId: 1, factA: 1, factB: 1, operation: 1 },
  { unique: true }
);
factMasterySchema.index({ userId: 1 });

module.exports = mongoose.model("FactMastery", factMasterySchema);
