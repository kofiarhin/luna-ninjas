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

const classifyBucket = (attempts, accuracy) => {
  if (attempts === 0) return "unseen";
  if (attempts === 1) return "learning";
  if (accuracy < 0.6) return "weak";
  if (accuracy < 0.85) return "learning";
  return "strong";
};

const buildMultiplicationCandidates = (table) => {
  const candidates = [];
  for (let m = 1; m <= 12; m++) {
    candidates.push({
      a: table,
      b: m,
      factA: Math.min(table, m),
      factB: Math.max(table, m),
    });
  }
  return candidates;
};

const buildDivisionCandidates = (table) => {
  const candidates = [];
  for (let q = 1; q <= 12; q++) {
    candidates.push({
      a: table,
      b: q,
      factA: table,
      factB: q,
    });
  }
  return candidates;
};

// GET /api/insights/smart-round?operation=<op>&table=<2..12>
const getSmartRoundPlan = async (req, res) => {
  const userId = req.auth.userId;
  const { operation, table } = req.query;
  const op = VALID_OPS.includes(operation) ? operation : null;
  const tableInt = Number.parseInt(table, 10);

  if (!op) {
    return res
      .status(400)
      .json({ message: "operation must be 'multiplication' or 'division'" });
  }

  if (!Number.isInteger(tableInt) || tableInt < 2 || tableInt > 12) {
    return res
      .status(400)
      .json({ message: "table must be an integer between 2 and 12" });
  }

  const candidates =
    op === "division"
      ? buildDivisionCandidates(tableInt)
      : buildMultiplicationCandidates(tableInt);

  const factPairs = candidates.map((c) => ({ factA: c.factA, factB: c.factB }));

  try {
    const records = await FactMastery.find({
      userId,
      operation: op,
      $or: factPairs,
    })
      .select("factA factB correct wrong lastSeen -_id")
      .lean();

    const recordMap = new Map(
      records.map((r) => [`${r.factA}-${r.factB}`, r])
    );

    const now = Date.now();

    const enriched = candidates.map((c) => {
      const key = `${c.factA}-${c.factB}`;
      const record = recordMap.get(key);
      const correct = record?.correct || 0;
      const wrong = record?.wrong || 0;
      const attempts = correct + wrong;
      const accuracy = attempts > 0 ? correct / attempts : 0;
      const bucket = classifyBucket(attempts, accuracy);
      const lastSeenTs = record?.lastSeen
        ? new Date(record.lastSeen).getTime()
        : 0;
      const priorityScore =
        (now - lastSeenTs) +
        (1 - accuracy) * 1000 +
        Math.min(attempts, 100);

      return {
        a: c.a,
        b: c.b,
        operation: op,
        bucket,
        attempts,
        accuracy: Number(accuracy.toFixed(4)),
        priorityScore: Math.round(priorityScore),
        lastSeenTs,
      };
    });

    const bucketOrder = ["weak", "learning", "unseen", "strong"];
    const bucketed = bucketOrder.flatMap((bucket) =>
      enriched
        .filter((f) => f.bucket === bucket)
        .sort((x, y) => {
          if (x.lastSeenTs !== y.lastSeenTs) return x.lastSeenTs - y.lastSeenTs;
          if (x.accuracy !== y.accuracy) return x.accuracy - y.accuracy;
          if (x.attempts !== y.attempts) return y.attempts - x.attempts;
          return x.b - y.b;
        })
    );

    const lowData = enriched.filter((f) => f.attempts > 0).length < 6;

    return res.json({
      facts: bucketed.map(({ lastSeenTs, ...fact }) => fact),
      lowData,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("getSmartRoundPlan error:", err);
    return res.status(500).json({ message: "Failed to build smart round plan" });
  }
};

module.exports = {
  recordInsights,
  getInsights,
  getSmartRoundPlan,
  __testables: {
    classifyBucket,
    buildMultiplicationCandidates,
    buildDivisionCandidates,
  },
};
