# Suggested Features for Luna Ninjas

Based on a thorough review of the codebase, here are 5 high-impact features to implement.

---

## 1. Daily Challenge Mode

**What:** A fixed daily set of 12 questions — same for all users on a given day — generated from a seeded random across all tables (2–12) and both operations. Users can only attempt it once per day.

**Why it fits:** The scoring, question generation, and leaderboard infrastructure are already in place. A daily challenge adds a strong retention hook and social comparison angle without requiring new data models beyond a `dailyChallengeAttempt` flag on the User or a separate thin collection.

**Key files to touch:**
- `server/models/user.model.js` — add `lastDailyChallenge: Date`
- `server/controllers/scoreController.js` — add a `POST /api/scores/daily` route that validates one-attempt-per-day
- `server/routes/scoreRoutes.js` — wire up the new route
- `client/src/utils/questionGenerator.js` — add `generateDailyRound(seed)` using a seeded PRNG (e.g. simple LCG or `seedrandom`)
- `client/src/Pages/Game/Game.jsx` — add a "Daily Challenge" entry point alongside the table selector
- `client/src/components/Leaderboard/Leaderboard.jsx` — add a tab for daily leaderboard

---

## 2. Achievements & Badges System

**What:** Award badges for reaching milestones such as: first game completed, flawless round (12/12 correct), mastering a table (≥90% accuracy across 20+ attempts), 7-day login streak, reaching top-10 on the leaderboard, etc.

**Why it fits:** The `FactMastery` collection already tracks accuracy per fact and per table. The User model already has `gamesPlayed` and `totalScore`. Achievements can be computed server-side after each score submission or insight record — no polling needed.

**Key files to touch:**
- `server/models/achievement.model.js` — new model: `{ userId, badge, unlockedAt }`
- `server/controllers/achievementController.js` — `checkAndAward(userId, context)` called after score submit / insight record
- `server/routes/achievementRoutes.js` — `GET /api/achievements` (auth-gated)
- `server/controllers/scoreController.js` — call `checkAndAward` after `$inc` on score
- `client/src/hooks/useAchievements.js` — fetch user's badges
- `client/src/Pages/Profile/Profile.jsx` — render badge shelf
- `client/src/components/GameSummary/GameSummary.jsx` — show newly unlocked badges after a round

---

## 3. Game History & Session Log

**What:** Persist each completed game round (table, operation, score earned, correctCount, timestamp) so users can review their play history — e.g. "last 20 games", trend graphs, personal bests per table.

**Why it fits:** `scoreController.js` already processes every round server-side. It currently only does `$inc` on the user document; a parallel `GameSession` insert costs almost nothing. The Insights page already shows per-fact accuracy but has no time dimension. A history log unlocks trend analysis and motivates improvement.

**Key files to touch:**
- `server/models/gameSession.model.js` — new model: `{ userId, table, operation, score, correctCount, totalQuestions, playedAt }`
- `server/controllers/scoreController.js` — `await GameSession.create(...)` alongside the existing `$inc`
- `server/routes/scoreRoutes.js` — add `GET /api/scores/history` (auth-gated, returns last 50 sessions)
- `client/src/hooks/useGameHistory.js` — new hook
- `client/src/Pages/Dashboard/Dashboard.jsx` — render history list and a simple score-over-time line chart (can use a lightweight lib like `recharts` or a plain SVG)

---

## 4. Timed vs. Relaxed Practice Mode

**What:** Let users choose between the current "Arcade" mode (8s timer, 5 lives, streak bonuses) and a new "Practice" mode (no timer, unlimited attempts, no score submission) for stress-free learning.

**Why it fits:** The timer and lives logic are isolated inside `MultiplicationGame.jsx`. A mode prop can disable them with minimal branching. Smart Practice already selects adaptive facts — pairing it with a relaxed mode makes it a proper learning tool rather than just a warm-up for the leaderboard.

**Key files to touch:**
- `client/src/Pages/Game/Game.jsx` — add mode selection step (Arcade / Practice) before table selection; pass `mode` prop down
- `client/src/components/PracticeModeSelector/PracticeModeSelector.jsx` — extend to include Arcade vs. Practice distinction (currently only Smart / Quick)
- `client/src/components/MultiplicationGame/MultiplicationGame.jsx` — accept `mode` prop; skip timer countdown and lives decrement when `mode === "practice"`; skip score submission (`useSubmitScore`) in practice mode
- `client/src/components/GameHeader/GameHeader.jsx` — hide timer and lives display in practice mode
- `client/src/components/GameSummary/GameSummary.jsx` — show accuracy-focused summary instead of score in practice mode

---

## 5. Weekly Time-Based Leaderboard

**What:** A leaderboard that resets every Monday at 00:00 UTC, showing the top 20 players by score earned *that week*. Runs alongside the existing all-time leaderboard.

**Why it fits:** The existing leaderboard is all-time and entrenched players dominate it, reducing motivation for new users. A weekly reset gives everyone a fresh start. The `GameSession` model from Feature 3 (or a simpler `weeklyScore` field on User) can power this. If Feature 3 is not built first, a lightweight `weeklyScore` + `weeklyResetAt` on the User model suffices.

**Key files to touch:**
- `server/models/user.model.js` — add `weeklyScore: Number` (default 0) and `weeklyResetAt: Date`
- `server/controllers/scoreController.js` — on each score submission, check if `weeklyResetAt` is in the past week; if not, reset `weeklyScore` to 0 and update `weeklyResetAt`; then `$inc` both `totalScore` and `weeklyScore`
- `server/controllers/scoreController.js` — add `getWeeklyLeaderboard` (same shape as `getLeaderboard` but sorted by `weeklyScore`)
- `server/routes/scoreRoutes.js` — add `GET /api/leaderboard/weekly`
- `client/src/hooks/useLeaderboard.js` — accept a `type` param (`"alltime"` | `"weekly"`)
- `client/src/components/Leaderboard/Leaderboard.jsx` — add tab toggle between All-Time and This Week
