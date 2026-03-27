const FactMastery = require("../models/factMastery.model");

const VALID_OPS = ["multiplication", "division"];

// POST /api/insights/record
// Body: { facts: [{ a, b, isCorrect, operation }] }
const recordInsights = async (req, res) => {
  const userId = req.auth.userId;
  const { facts } = req.body;

  if (!Array.isArray(facts) || facts.length === 0) {
    return res.status(400).json({ message: "facts array is required" });
  }

  const now = new Date();

  const ops = facts.map((f) => {
    const operation = VALID_OPS.includes(f.operation)
      ? f.operation
      : "multiplication";
    const incField = f.isCorrect ? "correct" : "wrong";

    // Multiplication: commutative normalization (min, max)
    // Division: store as-is — a = divisor (table), b = quotient
    const factA =
      operation === "multiplication" ? Math.min(f.a, f.b) : f.a;
    const factB =
      operation === "multiplication" ? Math.max(f.a, f.b) : f.b;

    return {
      updateOne: {
        filter: { userId, factA, factB, operation },
        update: {
          $inc: { [incField]: 1 },
          $set: { lastSeen: now },
        },
        upsert: true,
      },
    };
  });

  try {
    await FactMastery.bulkWrite(ops, { ordered: false });
    return res.json({ recorded: facts.length });
  } catch (err) {
    console.error("recordInsights error:", err);
    return res.status(500).json({ message: "Failed to record insights" });
  }
};

// GET /api/insights
const getInsights = async (req, res) => {
  const userId = req.auth.userId;

  try {
    const facts = await FactMastery.find({ userId })
      .select("factA factB operation correct wrong lastSeen -_id")
      .sort({ operation: 1, factA: 1, factB: 1 })
      .lean();

    return res.json({ facts });
  } catch (err) {
    console.error("getInsights error:", err);
    return res.status(500).json({ message: "Failed to fetch insights" });
  }
};

module.exports = { recordInsights, getInsights };
