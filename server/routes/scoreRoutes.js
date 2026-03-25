// server/routes/scoreRoutes.js
// Mounted at /api in app.js, giving:
//   POST /api/scores      — auth-gated score submission
//   GET  /api/leaderboard — public leaderboard

const { Router } = require("express");
const clerkAuth = require("../middleware/clerkAuth");
const { submitScore, getLeaderboard } = require("../controllers/scoreController");

const router = Router();

// POST /api/scores — requires valid Clerk JWT
router.post("/scores", clerkAuth, submitScore);

// GET /api/leaderboard — public, no auth
router.get("/leaderboard", getLeaderboard);

module.exports = router;
