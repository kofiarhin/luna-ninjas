# Luna Ninjas — Times Table Game Refactor: Technical Specification

## 1. Product Overview

Refactor the current multiplication game from a static-question, localStorage-based game into an account-based times-table game with server-persisted cumulative scoring and a public leaderboard.

**Core changes:**
- Replace static `sampledata.js` with dynamic, client-side question generation per selected times table
- Replace localStorage history with server-persisted score submissions
- Replace flat +10 scoring with weighted scoring based on table difficulty
- Add table selection screen (2–12) before each game round
- Add leaderboard to homepage showing top 20 users by cumulative total score
- Authenticate score submissions via Clerk JWT, not request body user IDs

---

## 2. Final End-to-End User Flow

1. User lands on `/home` → sees leaderboard (top 20, fetched from backend, no auth required)
2. User clicks "Begin Your Quest" → navigates to `/game`
3. If not signed in → redirected to `/login`
4. If signed in → sees **table selection screen** (buttons for 2–12)
5. User selects a table (e.g., 7) → sees difficulty selector (Easy/Medium/Ninja) → clicks Start
6. Game generates 12 questions: `7×1` through `7×12`, shuffled randomly
7. Each question shows 4 answer options (1 correct + 3 dynamically generated wrong answers), shuffled
8. User answers all questions (or loses all lives) → game ends → summary shown
9. Frontend calculates round score using weighted points → POSTs score to backend
10. Backend verifies Clerk JWT → extracts `clerkUserId` from token (not body) → atomically increments user's `totalScore`
11. User can play again (same or different table)
12. Leaderboard updates on next fetch

---

## 3. Frontend Architecture Changes

### 3.1 Files to Remove
- `client/src/Pages/Game/sampledata.js` — static questions, fully replaced by dynamic generation

### 3.2 Files to Create

| File | Purpose |
|------|---------|
| `client/src/utils/questionGenerator.js` | Pure function: `generateRound(table)` → returns 12 shuffled questions with answer options |
| `client/src/utils/scoring.js` | Pure function: `getPointsPerCorrect(table)` → returns weight; `calculateRoundScore(table, correctCount)` → returns total |
| `client/src/components/TableSelector/TableSelector.jsx` | Grid of buttons for tables 2–12, fires `onSelect(table)` |
| `client/src/components/TableSelector/table-selector.styles.scss` | Styles for table selector |
| `client/src/components/Leaderboard/Leaderboard.jsx` | Fetches and renders top 20 leaderboard |
| `client/src/components/Leaderboard/leaderboard.styles.scss` | Styles for leaderboard |
| `client/src/hooks/useLeaderboard.js` | Custom hook: fetches `GET /api/leaderboard`, returns `{ leaders, loading, error, refetch }` |
| `client/src/hooks/useSubmitScore.js` | Custom hook: POSTs score to `POST /api/scores`, returns `{ submit, loading, error }` |

### 3.3 Files to Modify

| File | Changes |
|------|---------|
| `client/src/Pages/Game/Game.jsx` | Remove `sampledata` import. Add table selection state. Pass selected table to `MultiplicationGame`. Use `questionGenerator.js` to produce questions. |
| `client/src/components/MultiplicationGame/MultiplicationGame.jsx` | Accept `table` prop instead of `questions` prop. Call `generateRound(table)` internally. Replace `+10` scoring with `getPointsPerCorrect(table)`. On game end, call score submission hook. Remove all localStorage history logic. |
| `client/src/Pages/Home/Home.jsx` | Add `<Leaderboard />` component below existing landing content. |
| `client/src/App.jsx` | No route changes needed. Existing `/game` guard with `<SignedIn>` already handles auth gating. |

### 3.4 Question Generator Design (`questionGenerator.js`)

**`generateRound(table)`**
- Input: `table` (integer 2–12)
- Output: array of 12 question objects

**Per question:**
- `a` = table (fixed)
- `b` = multiplier (1–12, no duplicates until pool exhausted)
- `correctAnswer` = `a * b`
- `wrongAnswers` = 3 unique integers, all different from `correctAnswer`, generated as plausible distractors

**Wrong answer generation strategy:**
- Pick 3 values from: `correctAnswer ± 1`, `correctAnswer ± 2`, `correctAnswer ± table`, `table * (b±1)` — filtering out duplicates, zero, negatives, and the correct answer
- If fewer than 3 candidates remain after filtering, fill with random values in range `[table, table * 12]` excluding `correctAnswer`
- Shuffle all 4 options

**Shuffling:** Fisher-Yates shuffle on both the question order and answer options.

### 3.5 Scoring Module Design (`scoring.js`)

```
WEIGHT_MAP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11 }

getPointsPerCorrect(table) → WEIGHT_MAP[table]
calculateRoundScore(table, correctCount) → WEIGHT_MAP[table] * correctCount
```

---

## 4. Backend Architecture Changes

### 4.1 New Middleware

| File | Purpose |
|------|---------|
| `server/middleware/clerkAuth.js` | Verifies Clerk JWT from `Authorization: Bearer <token>`. Extracts `clerkUserId` from the verified token payload and attaches it to `req.auth`. Rejects with 401 if invalid/missing. |

**Implementation approach:** Use Clerk's `@clerk/express` SDK or manually verify the JWT against Clerk's JWKS endpoint. The middleware must:
- Read the `Authorization` header
- Verify the JWT signature against Clerk's public keys
- Extract `sub` (which is the `clerkUserId`)
- Attach `req.auth = { userId: sub }` for downstream handlers
- Return 401 if token is missing, expired, or invalid

### 4.2 New Routes

| File | Purpose |
|------|---------|
| `server/routes/scoreRoutes.js` | `POST /api/scores` (auth required), `GET /api/leaderboard` (public) |

### 4.3 New Controller

| File | Purpose |
|------|---------|
| `server/controllers/scoreController.js` | `submitScore` and `getLeaderboard` handlers |

### 4.4 Files to Modify

| File | Changes |
|------|---------|
| `server/app.js` | Mount `scoreRoutes` at `/api/scores` and `/api/leaderboard` |
| `server/models/user.model.js` | Add `totalScore` and `displayName` fields (see schema section) |
| `package.json` | Add `@clerk/express` (or `@clerk/backend`) dependency |

### 4.5 Files That Can Be Removed Later (Not Blocking)
- `server/routes/questionRoutres.js` — Groq-based question generation no longer needed (questions generated client-side)
- `server/utility/helper.js` — Groq API caller
- `server/utility/systemPrompts.js` — LLM prompt
- `groq-sdk` dependency from `package.json`

These removals are optional and can happen in a cleanup phase. The routes can stay dormant without harm.

---

## 5. MongoDB Schema Updates

### Current User Schema
```
{
  clerkUserId: String (unique, indexed),
  email: String,
  firstName: String,
  lastName: String,
  imageUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Updated User Schema
```
{
  clerkUserId: String (unique, indexed),
  email: String,
  firstName: String,
  lastName: String,
  imageUrl: String,
  displayName: String (virtual or stored, derived from firstName + lastName initial),
  totalScore: { type: Number, default: 0, index: true },
  gamesPlayed: { type: Number, default: 0 },
  createdAt: Date,
  updatedAt: Date
}
```

**New fields:**
- `totalScore` — cumulative points across all games. Indexed for leaderboard sort. Default 0.
- `gamesPlayed` — total rounds completed. Useful for display and sanity checks. Default 0.
- `displayName` — stored field computed from `firstName` at registration time. Format: `firstName + " " + lastName[0] + "."` (e.g., "Laura B."). Falls back to `firstName` if no lastName. Falls back to "Anonymous Ninja" if neither exists. Updated when user profile is synced.

**Index:** Compound index on `{ totalScore: -1 }` for efficient leaderboard queries.

### Migration
- Add `totalScore: 0` and `gamesPlayed: 0` as schema defaults. Existing documents without these fields will read as `0` via Mongoose defaults — no data migration script needed.
- Backfill `displayName` for existing users: a one-time script that iterates all users and sets `displayName` from `firstName`/`lastName`. Alternatively, compute `displayName` lazily on first score submission.

---

## 6. Required API Endpoints

### 6.1 `POST /api/scores` (Authenticated)

**Purpose:** Submit a round score for the authenticated user.

**Auth:** Clerk JWT required via `clerkAuth` middleware. User identity comes from `req.auth.userId`, NOT from the request body.

**Request headers:**
```
Authorization: Bearer <clerk-jwt>
Content-Type: application/json
```

**Request body:**
```json
{
  "table": 7,
  "correctCount": 10,
  "totalQuestions": 12,
  "roundScore": 60
}
```

**Backend validation:**
1. `table` must be integer 2–12
2. `correctCount` must be integer 0–12
3. `totalQuestions` must be integer 1–12
4. `correctCount` <= `totalQuestions`
5. **Recompute `roundScore` server-side:** `expectedScore = WEIGHT_MAP[table] * correctCount`. If submitted `roundScore` !== `expectedScore`, use `expectedScore` (never trust client math)
6. Look up user by `req.auth.userId` (clerkUserId). If user not found, return 404.

**Backend logic:**
```
User.findOneAndUpdate(
  { clerkUserId: req.auth.userId },
  { $inc: { totalScore: expectedScore, gamesPlayed: 1 } },
  { new: true }
)
```

**Response (200):**
```json
{
  "roundScore": 60,
  "newTotalScore": 340,
  "gamesPlayed": 12
}
```

**Error responses:**
- 401: Missing or invalid JWT
- 404: User not found (clerkUserId not in DB)
- 400: Validation failure (invalid table, correctCount, etc.)

---

### 6.2 `GET /api/leaderboard` (Public)

**Purpose:** Return top 20 users by cumulative total score.

**Auth:** None required.

**Request:** No body or query params.

**Backend logic:**
```
User.find({ totalScore: { $gt: 0 } })
  .sort({ totalScore: -1 })
  .limit(20)
  .select('displayName totalScore gamesPlayed')
```

**Response (200):**
```json
{
  "leaderboard": [
    { "rank": 1, "displayName": "Laura B.", "totalScore": 540, "gamesPlayed": 18 },
    { "rank": 2, "displayName": "Kai M.", "totalScore": 320, "gamesPlayed": 10 },
    ...
  ]
}
```

**Notes:**
- Never return `clerkUserId`, `email`, or `imageUrl` in leaderboard response
- Only include users with `totalScore > 0`
- Rank is computed in the response mapping (index + 1), not stored

---

## 7. Clerk Auth Considerations and Secure Identity Handling

### Current Problem
The existing `POST /api/auth/register` endpoint trusts `clerkUserId` from `req.body`. Any client can forge this. This is acceptable for registration (Clerk already authenticated the user client-side) but NOT acceptable for score submissions where the identity determines who gets points.

### New Design
- Install `@clerk/express` on the backend
- Create `clerkAuth` middleware that verifies the Clerk session JWT
- The JWT's `sub` claim IS the `clerkUserId` — extract it server-side
- Score submission endpoint uses `req.auth.userId` exclusively
- No user-supplied ID is trusted for score-affecting operations

### Frontend Token Handling
- Use `useAuth()` from `@clerk/clerk-react` to get `getToken()`
- Pass `Authorization: Bearer ${token}` on score submission requests
- Leaderboard fetch needs no auth header

### Registration Endpoint (Existing)
- Can optionally be updated to use `clerkAuth` middleware too, but lower priority since it only creates user records (no scoring impact)

---

## 8. Leaderboard Logic

### Query
- Single MongoDB query: `find({ totalScore: { $gt: 0 } }).sort({ totalScore: -1 }).limit(20).select('displayName totalScore gamesPlayed')`
- Index on `totalScore` makes this efficient even with large user counts

### Tie-Breaking
- Users with identical `totalScore` are ordered by MongoDB's natural sort (insertion order). No secondary sort needed for MVP. Can add `gamesPlayed` ascending as tiebreaker later (fewer games = more efficient player).

### Caching (Optional, Post-MVP)
- Leaderboard changes only on score submission. Could cache for 30–60 seconds to avoid repeated DB queries. Not needed at current scale.

### Frontend Display
- Show rank (1–20), display name, total score
- Refresh on component mount (homepage load)
- No real-time updates needed

---

## 9. Game Round Logic

### Round Flow
1. User selects table (2–12) on the table selector screen
2. `generateRound(table)` produces 12 questions (table × 1 through table × 12, shuffled)
3. User selects difficulty (Easy 8s / Medium 6s / Ninja 4s) — existing behavior, unchanged
4. Game begins: questions presented one at a time with timer, lives, streak — existing mechanics
5. Each correct answer awards `WEIGHT_MAP[table]` points instead of flat 10
6. Game ends when all 12 questions are answered OR lives reach 0
7. Summary screen shows round score, accuracy, correct count
8. Frontend submits score to `POST /api/scores`
9. "Play Again" returns user to table selection screen

### Changes to `MultiplicationGame.jsx`
- `QUESTIONS_PER_GAME` changes from 20 to 12 (one full pass through multipliers 1–12)
- `questions` prop replaced: component calls `generateRound(table)` when game starts
- `score` calculation per correct answer: `getPointsPerCorrect(table)` instead of `+10`
- `finishGame` → after showing summary, calls `useSubmitScore` hook to POST to backend
- Remove all `localStorage` read/write code
- Remove `gameHistory` state and `ChatHistory` component rendering (replaced by leaderboard)

---

## 10. Score Aggregation Logic

### Server-Side Aggregation
- Scores are aggregated atomically using MongoDB's `$inc` operator
- `User.findOneAndUpdate({ clerkUserId }, { $inc: { totalScore: roundScore, gamesPlayed: 1 } })`
- This is atomic — no race conditions with concurrent submissions
- No separate `scores` or `games` collection needed for MVP
- The user document IS the leaderboard record

### Why Not a Separate Scores Collection?
- For this use case, only the cumulative total matters for the leaderboard
- A separate `GameRound` collection would be needed if we want per-game history, replay, or analytics
- Can be added later without breaking the leaderboard aggregation

---

## 11. Validation and Anti-Tampering Considerations

### Frontend Validation
- Table must be 2–12 (UI only shows these options)
- Score is calculated from `correctCount * weight` — no manual score entry
- Disable answer buttons after selection (existing behavior)

### Backend Validation (Critical)
1. **Identity:** JWT-verified `clerkUserId` only. Never trust body-supplied user IDs.
2. **Score recomputation:** Backend recalculates `roundScore = WEIGHT_MAP[table] * correctCount`. Ignores client-submitted `roundScore`.
3. **Range checks:**
   - `table` ∈ [2, 12] (integer)
   - `correctCount` ∈ [0, 12] (integer)
   - `totalQuestions` ∈ [1, 12] (integer)
   - `correctCount <= totalQuestions`
4. **User existence:** Must have a User document with matching `clerkUserId`. If not found → 404.
5. **Rate limiting (post-MVP):** Could add basic per-user rate limiting (e.g., max 1 submission per 5 seconds) to prevent automated spam. Not critical for MVP.

### What This Does NOT Protect Against
- A user could automate playing the game correctly in a browser — this is a kids' math game, not a casino. Perfect is the enemy of good here.
- If stricter anti-cheat is ever needed, move question generation and answer validation to the backend.

---

## 12. UI States and Screen-by-Screen Flow

### Screen 1: Homepage (`/home`)

| State | Display |
|-------|---------|
| Loading leaderboard | Spinner or skeleton rows |
| Leaderboard loaded, has entries | Top 20 table: rank, name, score |
| Leaderboard loaded, empty | "No scores yet. Be the first ninja!" |
| Leaderboard fetch error | "Could not load leaderboard." Retry button. |
| Existing content | Landing hero, "Begin Your Quest" button — unchanged |

### Screen 2: Game Page (`/game`) — Table Selection

| State | Display |
|-------|---------|
| Signed in, no table selected | Grid of 11 buttons (2–12). Each shows the number and point weight (e.g., "7× — 6 pts each") |
| Table selected | Highlight selected table. Show difficulty selector (Easy/Medium/Ninja) + Start button |

### Screen 3: Game Page (`/game`) — Active Game

No changes to visual layout. Existing `GameHeader`, `QuestionDisplay`, `AnswerOptions`, `WatermelonAnimation` all remain.

| State | Display |
|-------|---------|
| Question active | Question text (e.g., "7 × 9"), 4 answer buttons, timer, score, lives, streak |
| Correct answer | Green feedback, watermelon slice animation, score increments by weight |
| Wrong answer | Red feedback, hint shown, life lost |
| Timeout | "Time's up!", life lost |

### Screen 4: Game Page (`/game`) — Game Over

| State | Display |
|-------|---------|
| Game finished, submitting score | Summary card + "Saving score..." indicator |
| Score submitted | Summary card showing: table played, round score, correct/total, accuracy. "Play Again" button returns to table selection. |
| Score submission failed | Summary card + "Could not save score. Try again?" with retry button. Score still shown locally. |

---

## 13. Error States and Empty States

| Scenario | Handling |
|----------|----------|
| User not found on score submit (404) | Show error toast. Prompt user to log out and back in. This indicates the post-signup registration didn't complete. |
| JWT expired on score submit (401) | Clerk's `getToken()` should auto-refresh. If still 401, prompt re-login. |
| Network error on score submit | Show retry button on summary screen. Do not discard the round data. |
| Network error on leaderboard fetch | Show "Could not load leaderboard" with retry button. Don't block the rest of the homepage. |
| User plays game while logged out | Should not happen — `/game` route is gated by `<SignedIn>`. If somehow reached, redirect to `/login`. |
| Leaderboard has < 20 entries | Show however many exist. No padding with empty rows. |
| User has never played | Their `totalScore` is 0. They don't appear on leaderboard. No special handling needed. |

---

## 14. Migration Plan from Current Implementation

### Phase 0: Non-Breaking Preparation
- Add `totalScore`, `gamesPlayed`, `displayName` fields to User schema with defaults
- Add `clerkAuth` middleware (not yet applied to any route)
- Add score routes (new files, no existing code changes)

### Phase 1: Backend Go-Live
- Mount score routes in `app.js`
- Deploy backend independently — new endpoints are additive, nothing breaks

### Phase 2: Frontend Refactor
- Replace `Game.jsx` to use table selector + dynamic question generation
- Replace `MultiplicationGame.jsx` scoring and game-end logic
- Add score submission on game end
- Add leaderboard to homepage
- Remove `sampledata.js` import

### Phase 3: Cleanup
- Remove `sampledata.js`
- Optionally remove Groq question routes, helper, system prompts, and `groq-sdk` dependency
- Remove localStorage history code (already replaced in Phase 2)

### Data Migration
- No data migration needed. Existing users get `totalScore: 0` via schema default. Their leaderboard ranking starts from their first game under the new system.

---

## 15. File-by-File Implementation Plan

### Backend — New Files
| # | File | Description |
|---|------|-------------|
| 1 | `server/middleware/clerkAuth.js` | JWT verification middleware |
| 2 | `server/routes/scoreRoutes.js` | POST /api/scores, GET /api/leaderboard |
| 3 | `server/controllers/scoreController.js` | submitScore, getLeaderboard handlers |

### Backend — Modified Files
| # | File | Changes |
|---|------|---------|
| 4 | `server/models/user.model.js` | Add `totalScore`, `gamesPlayed`, `displayName` fields + index |
| 5 | `server/app.js` | Import and mount score routes |
| 6 | `package.json` (root) | Add `@clerk/express` or `@clerk/backend` dependency |

### Frontend — New Files
| # | File | Description |
|---|------|-------------|
| 7 | `client/src/utils/questionGenerator.js` | `generateRound(table)` function |
| 8 | `client/src/utils/scoring.js` | Weight map, `getPointsPerCorrect`, `calculateRoundScore` |
| 9 | `client/src/components/TableSelector/TableSelector.jsx` | Table selection grid UI |
| 10 | `client/src/components/TableSelector/table-selector.styles.scss` | Styles |
| 11 | `client/src/components/Leaderboard/Leaderboard.jsx` | Leaderboard display component |
| 12 | `client/src/components/Leaderboard/leaderboard.styles.scss` | Styles |
| 13 | `client/src/hooks/useLeaderboard.js` | Fetch leaderboard hook |
| 14 | `client/src/hooks/useSubmitScore.js` | Submit score hook |

### Frontend — Modified Files
| # | File | Changes |
|---|------|---------|
| 15 | `client/src/Pages/Game/Game.jsx` | Remove sampledata, add table selection state, pass table to game component |
| 16 | `client/src/components/MultiplicationGame/MultiplicationGame.jsx` | Dynamic questions, weighted scoring, score submission, remove localStorage |
| 17 | `client/src/Pages/Home/Home.jsx` | Add Leaderboard component |

### Frontend — Removed Files
| # | File | Reason |
|---|------|--------|
| 18 | `client/src/Pages/Game/sampledata.js` | Replaced by dynamic generation |

---

## 16. Testing Strategy

### Backend Unit Tests (Jest + Supertest)

| Test | What it validates |
|------|-------------------|
| `POST /api/scores` with valid JWT and body | Returns 200, increments totalScore and gamesPlayed |
| `POST /api/scores` with no JWT | Returns 401 |
| `POST /api/scores` with invalid table (e.g., 1, 13, "abc") | Returns 400 |
| `POST /api/scores` with correctCount > totalQuestions | Returns 400 |
| `POST /api/scores` with inflated roundScore | Backend recomputes, stores correct value |
| `POST /api/scores` for non-existent user | Returns 404 |
| `GET /api/leaderboard` | Returns array sorted by totalScore desc, max 20 |
| `GET /api/leaderboard` with no users | Returns empty array |
| Score atomicity | Two concurrent submissions both increment correctly |

### Frontend Unit Tests

| Test | What it validates |
|------|-------------------|
| `generateRound(7)` | Returns 12 questions, all with `a === 7`, `b` values are 1–12 (no dupes), each has 4 unique options including correct |
| `generateRound(2)` through `generateRound(12)` | All produce valid output |
| `getPointsPerCorrect(table)` | Returns correct weight for each table 2–12 |
| `calculateRoundScore(7, 10)` | Returns 60 |
| `TableSelector` component | Renders 11 buttons, fires onSelect with correct table number |

### Manual/E2E Tests

| Test | Steps |
|------|-------|
| Full game round | Login → select table → play game → verify score saved → check leaderboard |
| Leaderboard ranking | Two users play → verify correct ordering on homepage |
| Score persistence | Play game → refresh page → leaderboard still shows score |
| Auth protection | Try POST /api/scores without auth → verify 401 |

---

## 17. Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| User loses all lives on question 1 (0 correct) | Round score = 0. Submit 0 to backend. `$inc` by 0 is valid, `gamesPlayed` still increments. |
| User plays the same table 100 times | All scores accumulate. No per-table cap. |
| Two users tie on totalScore | Both shown at same effective rank. Ordered by DB natural sort. |
| User registers but never plays | `totalScore = 0`. Not shown on leaderboard (filtered by `$gt: 0`). |
| User deletes Clerk account | Orphaned MongoDB User document. No active sessions, so no new score submissions. Their leaderboard entry persists until manual cleanup. Acceptable for MVP. |
| Clerk JWT clock skew | Use a reasonable `clockTolerance` (e.g., 5 seconds) in JWT verification. |
| Network drops mid-score-submission | Frontend shows retry button. User's round data is still in React state. |
| User opens two game tabs simultaneously | Each tab submits independently. Both `$inc` operations apply atomically. Total is correct. |
| User refreshes during game | Game state is lost (React state). No partial score submitted. This matches current behavior. |
| Table selector shows wrong weight | Pure function from `WEIGHT_MAP` — tested and deterministic. |
| Very fast repeated submissions (bot) | Backend rate limiting (post-MVP). For now, each submission is validated and scored correctly. |

---

## 18. Acceptance Criteria

### Must Pass (MVP)

- [ ] Logged-in user can select a times table from 2–12
- [ ] Game generates exactly 12 questions for the selected table (multipliers 1–12, shuffled)
- [ ] Each question shows 4 answer options (1 correct, 3 wrong, shuffled)
- [ ] No two questions in a round have the same multiplier
- [ ] Correct answers award `table - 1` points (e.g., table 7 = 6 points)
- [ ] Round score is submitted to `POST /api/scores` with Clerk JWT
- [ ] Backend verifies JWT and extracts user identity from token, not body
- [ ] Backend recomputes round score from `table` and `correctCount` (ignores client-submitted score)
- [ ] Backend atomically increments `totalScore` and `gamesPlayed` on the User document
- [ ] `POST /api/scores` returns 401 without valid JWT
- [ ] `POST /api/scores` returns 400 for invalid table or correctCount
- [ ] Homepage displays top 20 leaderboard sorted by `totalScore` descending
- [ ] Leaderboard shows display name and total score (no email, no clerkUserId)
- [ ] Leaderboard is publicly accessible (no auth required)
- [ ] Leaderboard shows empty state when no scores exist
- [ ] No localStorage is used for score tracking or leaderboard
- [ ] No manual username entry anywhere in the flow
- [ ] Static `sampledata.js` is no longer used in production game flow
- [ ] Existing difficulty levels (Easy/Medium/Ninja timer) still work
- [ ] Existing lives, streak, watermelon animations still work

---

## 19. Build Order in Phases

### Phase 1: Backend Foundation (No frontend changes, no breaking changes)

1. Add `@clerk/express` or `@clerk/backend` to root `package.json`
2. Update `server/models/user.model.js` — add `totalScore`, `gamesPlayed`, `displayName` fields with defaults and index
3. Create `server/middleware/clerkAuth.js` — JWT verification
4. Create `server/controllers/scoreController.js` — `submitScore` and `getLeaderboard`
5. Create `server/routes/scoreRoutes.js` — wire routes
6. Update `server/app.js` — mount new routes
7. Write backend tests for both endpoints
8. Test with Postman/curl to confirm endpoints work

### Phase 2: Frontend Utilities (No UI changes yet)

9. Create `client/src/utils/scoring.js` — weight map and score functions
10. Create `client/src/utils/questionGenerator.js` — `generateRound(table)`
11. Write unit tests for both utility modules

### Phase 3: Frontend Game Refactor

12. Create `client/src/components/TableSelector/TableSelector.jsx` + styles
13. Create `client/src/hooks/useSubmitScore.js`
14. Update `client/src/Pages/Game/Game.jsx` — integrate table selector, remove sampledata
15. Update `client/src/components/MultiplicationGame/MultiplicationGame.jsx` — dynamic questions, weighted scoring, score submission, remove localStorage logic

### Phase 4: Leaderboard

16. Create `client/src/hooks/useLeaderboard.js`
17. Create `client/src/components/Leaderboard/Leaderboard.jsx` + styles
18. Update `client/src/Pages/Home/Home.jsx` — add leaderboard to homepage

### Phase 5: Cleanup

19. Delete `client/src/Pages/Game/sampledata.js`
20. (Optional) Remove Groq question routes, helper.js, systemPrompts.js, groq-sdk dependency
21. End-to-end testing
22. Deploy

---

## 20. Risks in the Current Implementation and How the New Design Fixes Them

### Risk 1: Identity Spoofing on Backend
**Current:** `POST /api/auth/register` trusts `clerkUserId` from `req.body`. Any HTTP client can register or act as any user.
**New design:** Score submission uses JWT verification. `clerkUserId` is extracted from a cryptographically signed token verified against Clerk's public keys. Cannot be forged.

### Risk 2: localStorage as Source of Truth
**Current:** Game history and scores stored in `window.localStorage`. Users can edit, clear, or lose this data. Scores are not comparable across devices or users.
**New design:** All scores persisted in MongoDB, tied to authenticated user accounts. Consistent across devices and sessions.

### Risk 3: Static Question Pool
**Current:** `sampledata.js` has 15 hardcoded questions covering tables 1–7. Users quickly memorize the answer positions.
**New design:** 12 dynamically generated questions per round for any table 2–12. Shuffled order and shuffled answer positions every time. 132 possible unique questions across all tables.

### Risk 4: Flat Scoring Removes Incentive for Harder Tables
**Current:** Every correct answer is +10 regardless of difficulty. No reason to attempt table 12 over table 2.
**New design:** Weighted scoring (1–11 points) rewards harder tables. Players must balance accuracy vs. risk for leaderboard climbing.

### Risk 5: No Competitive Element
**Current:** No way for users to compare performance. Game is single-player with no persistence.
**New design:** Cumulative leaderboard on homepage creates social motivation. Persistent scores across sessions give a sense of progression.

### Risk 6: Groq API Dependency for Core Gameplay
**Current:** Question generation depends on external Groq LLM API call. If the API is down, rate-limited, or slow, the game breaks entirely.
**New design:** Questions generated client-side with pure deterministic functions. Zero external dependencies for core gameplay. Instant, offline-capable question generation.

### Risk 7: No Backend Validation of Scores
**Current:** No score submission to backend at all — everything is client-side.
**New design:** Backend recomputes scores from `table` and `correctCount`. Even if a client sends a fabricated `roundScore`, the backend ignores it and calculates the correct value.
