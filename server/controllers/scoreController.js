// server/controllers/scoreController.js
const User = require("../models/user.model");
const { WEIGHT_MAP } = require("../constants/scoring");

/**
 * POST /api/scores
 * Authenticated. Recomputes round score server-side and atomically increments
 * the user's totalScore and gamesPlayed. Returns 404 if the user record does
 * not exist — no auto-creation fallback.
 */
const submitScore = async (req, res, next) => {
  try {
    const userId = req.auth.userId; // set by authMiddleware — never from body
    const { table, correctCount } = req.body;

    // --- Validation ---
    const tableInt = parseInt(table, 10);
    if (!Number.isInteger(tableInt) || tableInt < 2 || tableInt > 12) {
      return res
        .status(400)
        .json({ message: "table must be an integer between 2 and 12" });
    }

    const correctCountInt = parseInt(correctCount, 10);
    if (
      !Number.isInteger(correctCountInt) ||
      correctCountInt < 0 ||
      correctCountInt > 12
    ) {
      return res
        .status(400)
        .json({ message: "correctCount must be an integer between 0 and 12" });
    }

    // --- Recompute score server-side (never trust client-supplied roundScore) ---
    const roundScore = WEIGHT_MAP[tableInt] * correctCountInt;

    // --- Find user by MongoDB _id and increment counters ---
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { totalScore: roundScore, gamesPlayed: 1 } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    return res.json({
      roundScore,
      newTotalScore: user.totalScore,
      gamesPlayed: user.gamesPlayed,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/leaderboard
 * Public — no auth required.
 * Returns the top 20 users by totalScore descending.
 * Never returns passwordHash, email, or internal IDs.
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const users = await User.find({ totalScore: { $gt: 0 } })
      .sort({ totalScore: -1, createdAt: 1 })
      .limit(20)
      .select("displayName username fullName totalScore gamesPlayed");

    const leaderboard = users
      .map((user, index) => {
        const name =
          (user.displayName || "").trim() ||
          (user.username || "").trim() ||
          (user.fullName || "").trim();
        return {
          rank: index + 1,
          name: name || null,
          totalScore: user.totalScore,
          gamesPlayed: user.gamesPlayed,
        };
      })
      .filter((entry) => entry.name);

    return res.json({ leaderboard });
  } catch (err) {
    return next(err);
  }
};

module.exports = { submitScore, getLeaderboard };
