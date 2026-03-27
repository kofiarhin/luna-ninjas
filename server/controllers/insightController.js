const FactMastery = require("../models/factMastery.model");

// POST /api/insights/record
// Body: { facts: [{ a, b, isCorrect }] }
const recordInsights = async (req, res) => {
  const userId = req.auth.userId;
  const { facts } = req.body;

  if (!Array.isArray(facts) || facts.length === 0) {
    return res.status(400).json({ message: "facts array is required" });
  }

  const now = new Date();

  const ops = facts.map((f) => {
    const factA = Math.min(f.a, f.b);
    const factB = Math.max(f.a, f.b);
    const incField = f.isCorrect ? "correct" : "wrong";

    return {
      updateOne: {
        filter: { userId, factA, factB },
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
      .select("factA factB correct wrong lastSeen -_id")
      .sort({ factA: 1, factB: 1 })
      .lean();

    return res.json({ facts });
  } catch (err) {
    console.error("getInsights error:", err);
    return res.status(500).json({ message: "Failed to fetch insights" });
  }
};

module.exports = { recordInsights, getInsights };
