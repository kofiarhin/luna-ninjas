const { Router } = require("express");
const { generateMultiplicationQuestions } = require("../utility/helper");

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const rawHistory = Array.isArray(req.body.history) ? req.body.history : [];

    // 🔥 SANITIZE HISTORY to reduce token usage
    const sanitizedHistory = rawHistory
      .slice(-10) // keep last 10 games ONLY
      .map((game) => ({
        score: game.score,
        accuracy: game.accuracy,
        level: game.level,
        correctCount: game.correctCount,
        totalQuestions: game.totalQuestions,
        timestamp: game.timestamp,
        // sanitize inner game play log
        history: Array.isArray(game.history)
          ? game.history.map((q) => ({
              a: q.a,
              b: q.b,
              correctAnswer: q.correctAnswer,
              userAnswer: q.userAnswer,
              isCorrect: q.isCorrect,
            }))
          : [],
      }));

    // 🔥 Pass sanitized version to LLM logic
    const questions = await generateMultiplicationQuestions(sanitizedHistory);

    return res.json(questions);
  } catch (err) {
    console.error("Error in /api/questions:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
