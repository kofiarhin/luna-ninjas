// server/controllers/scoreController.js
const User = require("../models/user.model");
const { WEIGHT_MAP } = require("../constants/scoring");

/**
 * POST /api/scores
 * Authenticated. Verifies JWT (via clerkAuth middleware), recomputes round score
 * server-side, and atomically increments the user's totalScore and gamesPlayed.
 */
const submitScore = async (req, res, next) => {
  try {
    const userId = req.auth.userId; // set by clerkAuth middleware — never from body
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

    // --- Find user by verified clerkUserId, or create if missing ---
    const user = await User.findOneAndUpdate(
      { clerkUserId: userId },
      {
        $inc: { totalScore: roundScore, gamesPlayed: 1 },
        $setOnInsert: {
          clerkUserId: userId,
          email: "",
          displayName: "Anonymous Ninja",
        },
      },
      { new: true, upsert: true }
    );

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
 * Never returns clerkUserId, email, or imageUrl.
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const users = await User.find({ totalScore: { $gt: 0 } })
      .sort({ totalScore: -1, createdAt: 1 })
      .limit(20)
      .select("displayName totalScore gamesPlayed");

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      displayName: user.displayName || "Anonymous Ninja",
      totalScore: user.totalScore,
      gamesPlayed: user.gamesPlayed,
    }));

    return res.json({ leaderboard });
  } catch (err) {
    return next(err);
  }
};

module.exports = { submitScore, getLeaderboard };
