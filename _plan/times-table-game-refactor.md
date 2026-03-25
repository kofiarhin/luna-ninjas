# Times Table Game Refactor — Account-Based Leaderboard

## Summary

Refactor the existing Luna Ninjas multiplication game from a static-question, localStorage-based single-player experience into an account-based, server-persisted game with a public leaderboard. Players select a times table (2–12), receive dynamically generated questions for that table, earn weighted points per correct answer, and accumulate a total score tied to their Clerk account. The homepage displays the top 20 players by cumulative score.

## Goal

A logged-in user can select a times table, play a full round of dynamically generated questions, have their round score submitted securely to the backend, and see their rank on the homepage leaderboard. Scores persist across sessions and devices.

## Non-Goals

- Moving question generation to the backend (stays client-side for now)
- Per-table leaderboards or per-game history views
- Real-time leaderboard updates (WebSockets, polling)
- Admin moderation or score resets via UI
- Adaptive difficulty via the Groq LLM (can be removed)
- Mobile app or PWA changes
- Profile pages or per-user history dashboards

## Problem

The current implementation has five structural problems:

1. **Questions are static.** `sampledata.js` has 15 hardcoded questions covering tables 1–7. Players memorise answer positions quickly. There is no selection of a specific table.
2. **Scores are local.** All scoring and history lives in `localStorage`. Scores cannot be compared across users, devices, or sessions.
3. **No leaderboard.** There is no competitive or social element.
4. **Flat scoring.** Every correct answer is +10 regardless of difficulty. No incentive to attempt harder tables.
5. **Identity is not verified server-side.** The existing `/api/auth/register` endpoint trusts `clerkUserId` from `req.body`. Score submissions would carry the same vulnerability if built the same way.

## Users / Actors

| Actor | Description |
|-------|-------------|
| Authenticated player | A logged-in user who selects a table, plays a round, and submits a score |
| Anonymous visitor | Can view the homepage leaderboard but cannot play |
| Backend | Verifies identity via Clerk JWT, persists scores, serves leaderboard |

## Core Requirements

1. Authenticated users can select one times table from 2 to 12 before a game starts. No difficulty selector is presented — the table choice is the only pre-game decision.
2. One round equals exactly 12 questions. The selected table is the fixed first operand. Multipliers are 1–12, used exactly once per round, reshuffled fresh at the start of every new round.
3. Each question presents 4 answer choices: 1 correct answer and 3 dynamically generated wrong answers, all shuffled.
4. Each correct answer scores weighted points: `table - 1` points (table 2 = 1pt, table 12 = 11pts).
5. The round ends when all 12 questions are answered or the player runs out of lives.
6. On game end, the frontend submits the round result to `POST /api/scores` with a Clerk JWT in the `Authorization` header.
7. The backend verifies the JWT, extracts `clerkUserId` from the token (never from the request body), recomputes the score server-side, and increments the user's `totalScore` and `gamesPlayed` atomically.
8. The homepage fetches `GET /api/leaderboard` (no auth required) and displays the top 20 players ranked by `totalScore` descending, showing display name and total score.
9. `sampledata.js` is no longer used in the production game flow.
10. `localStorage` must not be used for score persistence, leaderboard ranking, or authoritative game history. All persistent data lives in MongoDB.

## User Flows

### Flow 1 — First-time player
1. User lands on `/home` → leaderboard loads (or shows empty state)
2. User clicks "Begin Your Quest"
3. Not signed in → redirected to `/login`
4. Completes Clerk auth → redirected to `/post-signup` → user registered in MongoDB → redirected to `/home`
5. Clicks "Begin Your Quest" again → navigated to `/game`
6. Sees **Table Selection screen** — 11 buttons for tables 2–12
7. Selects a table → sees a confirmation ("You chose: ×7") and a Start button
8. Clicks Start → 12 questions generated fresh for that table → game begins immediately
9. Plays round → game ends → sees summary
10. Frontend POSTs score to backend with JWT
11. Score saved → "Play Again" returns to table selection screen

### Flow 2 — Returning player
1. User lands on `/home` → sees leaderboard with their name (if in top 20)
2. Clicks "Begin Your Quest" → already signed in → goes straight to `/game`
3. Plays a round → score submitted → cumulative `totalScore` incremented

### Flow 3 — Anonymous visitor
1. Lands on `/home` → sees leaderboard
2. Cannot navigate to `/game` without auth (existing `<SignedIn>` guard)

## Functional Details

### UI / Pages / Components

#### Homepage (`/home`) — modified
- Below the existing hero content, render a `<Leaderboard />` component
- Leaderboard fetches `GET /api/leaderboard` on every mount — this ensures that when a user finishes a round and navigates back to `/home`, the leaderboard reflects their newly submitted score without requiring a manual refresh
- Shows: rank, display name, total score (3 columns)
- Loading state: spinner or skeleton rows
- Empty state: "No scores yet. Be the first ninja!"
- Error state: "Could not load leaderboard." + retry button

#### Game Page (`/game`) — modified
Replaces the current single-screen layout with a two-step entry flow:

**Step 1 — Table Selection screen** (shown when `selectedTable === null`):
- Heading: "Choose your times table"
- 11 buttons, one per table (2–12)
- Each button shows the table number and points value: e.g. "×7 — 6 pts"
- Clicking a button sets `selectedTable` and advances to Step 2

**Step 2 — Ready screen** (shown when `selectedTable` is set, before game starts):
- Shows selected table ("You chose: ×7") and the points value ("6 pts per correct answer")
- Start Game button
- "Change table" link returns to Step 1
- No difficulty selector — difficulty selection is removed from this flow entirely

**Active game** — same layout as current, with:
- Score increments by `table - 1` per correct answer (not flat +10)
- A single fixed timer per question (default: 8 seconds — the former "Easy" timing). Timer behaviour, lives, streak, and watermelon animation are otherwise unchanged

**Game Over screen**:
- Shows: table played, round score, correct/total, accuracy, lives remaining
- "Saving score…" indicator while POST is in flight
- On success: "Score saved!" → "Play Again" (returns to Table Selection)
- On failure: "Could not save score." + Retry button (holds round data in state)

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `TableSelector` | `client/src/components/TableSelector/TableSelector.jsx` | Grid of table buttons |
| `Leaderboard` | `client/src/components/Leaderboard/Leaderboard.jsx` | Fetches + renders top 20 |

### New Utilities

| Utility | File | Purpose |
|---------|------|---------|
| `questionGenerator` | `client/src/utils/questionGenerator.js` | `generateRound(table)` → 12 shuffled question objects |
| `scoring` | `client/src/utils/scoring.js` | `WEIGHT_MAP`, `getPointsPerCorrect(table)`, `calculateRoundScore(table, correctCount)` |

### New Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useLeaderboard` | `client/src/hooks/useLeaderboard.js` | `{ leaders, loading, error, refetch }` |
| `useSubmitScore` | `client/src/hooks/useSubmitScore.js` | `{ submit(payload), loading, error }` — attaches Clerk JWT |

### Routing / Navigation

No new routes. Existing `/game` route already guarded by `<SignedIn>`. "Play Again" resets internal component state to table selection rather than navigating away.

### Authentication / Authorization

#### Frontend
- `useAuth()` from `@clerk/clerk-react` provides `getToken()`
- `useSubmitScore` calls `getToken()` before each POST and attaches `Authorization: Bearer <token>`
- No auth header needed for leaderboard fetch

#### Backend
- New middleware `clerkAuth.js` verifies the JWT against Clerk's JWKS endpoint (via `@clerk/express` or `@clerk/backend`)
- Extracts `sub` from verified token payload → sets `req.auth = { userId: sub }`
- Returns 401 if token is missing, malformed, or expired
- `POST /api/scores` uses this middleware
- `GET /api/leaderboard` is public — no middleware

### Backend

#### New dependency
`@clerk/express` (or `@clerk/backend`) added to root `package.json` for server-side JWT verification.

#### New files

Both endpoints relate to the score/leaderboard domain and can live in the same route and controller files, but their handler functions must be clearly separated with no shared logic between `submitScore` and `getLeaderboard`.

- `server/middleware/clerkAuth.js` — JWT verification only; applies to `POST /api/scores`, not to `GET /api/leaderboard`
- `server/routes/scoreRoutes.js` — defines both `POST /api/scores` (with `clerkAuth`) and `GET /api/leaderboard` (public) in a single router file
- `server/controllers/scoreController.js` — exports `submitScore` and `getLeaderboard` as two independent functions with no shared state or logic

If route responsibilities grow beyond these two endpoints, split into separate route and controller files at that point. Do not pre-split for the current scope.

#### Modified files
- `server/app.js` — mounts the single score router, which exposes the two public endpoints: `POST /api/scores` and `GET /api/leaderboard`
- `server/models/user.model.js` — new fields

### API Endpoints

#### `POST /api/scores`

**Auth:** Required. Clerk JWT in `Authorization: Bearer <token>`.

**Request body:**
```
{
  "table": 7,
  "correctCount": 10
}
```

**Backend behaviour:**
1. Verify JWT → extract `userId` from `req.auth`
2. Validate: `table` ∈ [2,12] integer; `correctCount` ∈ [0,12] integer
3. Recompute score: `roundScore = WEIGHT_MAP[table] * correctCount` — round length is fixed at 12 by game design; the backend does not accept or require a `totalQuestions` field
4. Find user by `clerkUserId === userId` — 404 if not found
5. Atomically: `$inc: { totalScore: roundScore, gamesPlayed: 1 }`

**Response 200:**
```
{
  "roundScore": 60,
  "newTotalScore": 340,
  "gamesPlayed": 12
}
```

**Error responses:**
- `401` — missing/invalid/expired JWT
- `404` — no User document for this clerkUserId
- `400` — validation failure (message describing the failing field)

---

#### `GET /api/leaderboard`

**Auth:** None.

**Response 200:**
```
{
  "leaderboard": [
    { "rank": 1, "displayName": "Laura B.", "totalScore": 540, "gamesPlayed": 18 },
    { "rank": 2, "displayName": "Kai M.", "totalScore": 320, "gamesPlayed": 10 }
  ]
}
```

**Query:**
```
User.find({ totalScore: { $gt: 0 } })
  .sort({ totalScore: -1, createdAt: 1 })
  .limit(20)
  .select('displayName totalScore gamesPlayed')
```

Tie-breaking is deterministic: users with identical `totalScore` are sorted by `createdAt` ascending — the earlier account ranks higher. This is consistent across every call and requires no additional logic.

Never return `clerkUserId`, `email`, or `imageUrl` in this response.

### Validation

| Field | Rule |
|-------|------|
| `table` | Integer, 2–12 inclusive |
| `correctCount` | Integer, 0–12 inclusive |
| `roundScore` (client-submitted) | Ignored — recomputed server-side |
| JWT | Must be present, valid signature, not expired |
| `clerkUserId` from body | Never used for scoring — token only |

### Security Posture and Anti-Tampering

**What this design protects against:**
- Score inflation: the backend ignores any `roundScore` the client sends and recomputes it from `WEIGHT_MAP[table] * correctCount`.
- Identity spoofing: `clerkUserId` is extracted from a cryptographically verified JWT, not from the request body.

**Known limitation in MVP:**
- The backend trusts the client-reported `correctCount`. A user who modifies the network request can submit a higher `correctCount` than they actually achieved. This is a known and accepted trade-off for MVP scope.

**What full anti-cheat would require (future work, not in scope):**
- Server-issued questions: the backend generates and stores a signed question set per session; client receives question IDs, not values.
- Signed round state: each answer is submitted individually with a server-verifiable token, so the backend can track correctness independently.
- This level of protection is disproportionate for a kids' math game at this stage.

**localStorage is explicitly prohibited** as a source of truth for score persistence, leaderboard ranking, or authoritative game history. It may be used for transient UI state (e.g. selected table before game starts) but never for anything that flows to or from the backend.

### Database Changes

#### User model — new fields

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `totalScore` | Number | 0 | Indexed for leaderboard sort |
| `gamesPlayed` | Number | 0 | Informational |
| `displayName` | String | "" | Derived from Clerk profile at registration — see sourcing rules below |

No migration script needed. Mongoose defaults populate missing fields as `0`/`""` on read for existing documents.

Add index: `{ totalScore: -1 }` on the User collection.

**`displayName` sourcing rules** (applied at registration in `authController.js`, in priority order):
1. If Clerk provides a non-empty `fullName` (i.e. `user.fullName`) — use it directly.
2. If no full name but `firstName` is present — use `firstName` alone.
3. If neither is available — use `"Anonymous Ninja"`.

Do not enforce a specific format (e.g. "Last initial + dot"). Store whatever Clerk provides. This is more resilient to Clerk accounts that only have an email address or a single name. The field is stored at registration time and not recomputed on each leaderboard query.

#### Scoring weight map (backend constant)

```
WEIGHT_MAP = { 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7, 9:8, 10:9, 11:10, 12:11 }
```

Store this in a shared constants file on the backend (`server/constants/scoring.js`) so it can be used by both the controller and any future tests.

### Question Generation (Frontend)

`generateRound(table)` returns an array of 12 objects:

```
{
  a: table,           // fixed first operand
  b: multiplier,      // 1–12, shuffled, no repeats
  correctAnswer: a*b,
  options: [...]      // 4 integers, shuffled, includes correctAnswer
}
```

**Wrong answer generation:**
- Generate candidates from: `correctAnswer ± 1`, `correctAnswer ± 2`, `correctAnswer ± table`, `table * (b ± 1)`
- Filter: remove `correctAnswer`, negatives, zero, duplicates
- If fewer than 3 candidates remain, fill with random integers in `[table, table * 12]` excluding `correctAnswer`
- Take 3, combine with `correctAnswer`, shuffle all 4

**Shuffling:** Fisher-Yates on both question order and options array.

## States and Edge Cases

| Scenario | Handling |
|----------|----------|
| User loses all lives on Q1 (0 correct) | Round score = 0. Submit with `correctCount: 0`. `$inc` by 0 is valid. `gamesPlayed` still increments. |
| JWT expired when submitting score | `getToken()` auto-refreshes via Clerk SDK. If still 401 after refresh, show "Session expired — please log in again." |
| User not found on score submit (404) | Post-signup registration didn't complete. Show: "Account sync issue — please log out and back in." |
| Network error on score submit | Show retry button on summary screen. Round data stays in component state. |
| Leaderboard fetch fails | Show error message + retry. Does not block hero section of homepage. |
| Leaderboard has 0 entries | Show: "No scores yet. Be the first ninja!" |
| Leaderboard has < 20 entries | Show however many exist. No padding. |
| User plays on two tabs simultaneously | Each tab submits independently. `$inc` is atomic. Both submissions apply correctly. |
| Page refresh mid-game | React state lost. No partial score submitted. Acceptable. |
| `displayName` is empty (no firstName/lastName) | Fall back to "Anonymous Ninja" |
| User deletes Clerk account | MongoDB document persists. No new submissions possible. Leaderboard entry remains. Acceptable for MVP. |
| Two users have identical `totalScore` | Sorted by `createdAt: 1` as tiebreaker — earlier account ranks higher. Deterministic and consistent across all calls. |
| Client sends inflated `roundScore` | Backend ignores it. Server recomputes from `table` and `correctCount`. |

## Technical Notes

- `@clerk/express` must be installed on the server. It provides `clerkMiddleware()` and `getAuth()` for Express, which handle JWKS fetching and caching automatically.
- `CLERK_SECRET_KEY` must be added to the server's `.env` file. Clerk's middleware reads it from `process.env.CLERK_SECRET_KEY`.
- `CLERK_PUBLISHABLE_KEY` is already present in `client/.env`.
- The existing `POST /api/questions` (Groq LLM route) and its supporting files (`helper.js`, `systemPrompts.js`, `groq-sdk`) can be removed in a cleanup phase. They are not blocking and can stay dormant.
- **Registration endpoint hardening (future task):** The existing `POST /api/auth/register` trusts `clerkUserId` from `req.body`. For registration specifically this is temporarily acceptable — the user has just completed Clerk auth client-side, so the session is real. However, a determined actor could call this endpoint with an arbitrary `clerkUserId` and create a phantom user record. This should be hardened in a follow-up task by applying the same `clerkAuth` middleware to registration, so the `clerkUserId` is always extracted from the verified JWT rather than the body. This is not blocking for the current refactor but must not be used as a model for score submissions.
- Atomic `$inc` in MongoDB prevents race conditions from concurrent score submissions.
- The `displayName` field is stored (not computed at query time) so leaderboard queries stay a single `.find()` with no aggregation pipeline.
- `constans.js` (typo in filename) in `client/src/constants/` should not be renamed in this task — out of scope.

## Acceptance Criteria

- [ ] Authenticated user sees a table selection screen (buttons 2–12) when navigating to `/game`
- [ ] Selecting a table and starting a game generates exactly 12 questions for that table (multipliers 1–12, no duplicates)
- [ ] Each question displays 4 answer choices: 1 correct, 3 wrong, all shuffled
- [ ] Correct answers award `table - 1` points (e.g., table 7 = 6 pts per correct answer)
- [ ] Game ends when all 12 questions are answered or lives reach 0
- [ ] On game end, frontend POSTs to `POST /api/scores` with a valid Clerk JWT in the `Authorization` header
- [ ] Backend verifies JWT and extracts `clerkUserId` from token — never from request body
- [ ] Backend recomputes `roundScore` server-side from `table` and `correctCount`
- [ ] Backend atomically increments `totalScore` and `gamesPlayed` on the User document
- [ ] `POST /api/scores` returns 401 with no or invalid JWT
- [ ] `POST /api/scores` returns 400 for `table` outside 2–12
- [ ] `POST /api/scores` returns 400 for `correctCount` outside 0–12
- [ ] `POST /api/scores` returns 404 if no User document exists for the authenticated clerkUserId
- [ ] `GET /api/leaderboard` returns up to 20 users sorted by `totalScore` descending
- [ ] `GET /api/leaderboard` response never includes `clerkUserId`, `email`, or `imageUrl`
- [ ] `GET /api/leaderboard` returns an empty array when no users have scores
- [ ] Homepage renders the leaderboard below the hero section
- [ ] Leaderboard shows rank, display name, and total score
- [ ] Leaderboard shows empty state when result is empty
- [ ] Leaderboard shows error state with retry when fetch fails
- [ ] `sampledata.js` is no longer imported in the production game path
- [ ] `localStorage` is not used for score persistence, leaderboard ranking, or authoritative game history
- [ ] No difficulty selector (Easy / Medium / Ninja) appears in the new game flow
- [ ] A single fixed 8-second timer is used per question
- [ ] Lives system, streak, and watermelon animations are unchanged
- [ ] Leaderboard sorts by `totalScore` descending, then `createdAt` ascending for ties
- [ ] `correctCount` is trusted from the client in MVP — this is documented as a known limitation, not an oversight

## Open Questions

- None at this stage.

## Assumptions

- Clerk's `sub` claim in the JWT matches the `clerkUserId` stored in MongoDB (standard Clerk behaviour).
- `displayName` is sourced from Clerk's `fullName` if present, then `firstName`, then "Anonymous Ninja". No rigid format is enforced.
- A round is always 12 questions — exactly one pass through multipliers 1–12, reshuffled fresh per round. The existing `QUESTIONS_PER_GAME = 20` constant will be replaced with 12.
- The difficulty selector (Easy / Medium / Ninja) is fully removed. A single fixed 8-second timer per question replaces it.
- The `ChatHistory` component (which displays localStorage-based game history) will be removed from the game screen as part of this refactor. It has no equivalent in the new design.
- The Groq LLM question generation route is left in place but unused. It will be cleaned up in a separate task.
- `gamesPlayed` counts rounds submitted to the backend, not rounds played. A game abandoned before submission is not counted.
- The registration endpoint hardening (applying `clerkAuth` to `POST /api/auth/register`) is a follow-up task and is not part of this refactor.

---

## Appendix — File Impact List

### Backend — New Files
| File | Purpose |
|------|---------|
| `server/middleware/clerkAuth.js` | JWT verification middleware |
| `server/routes/scoreRoutes.js` | `POST /api/scores` (auth-gated) and `GET /api/leaderboard` (public) — two clearly separated route definitions |
| `server/controllers/scoreController.js` | `submitScore` and `getLeaderboard` — two independent exported functions |
| `server/constants/scoring.js` | WEIGHT_MAP constant shared across backend |

### Backend — Modified Files
| File | Change |
|------|--------|
| `server/models/user.model.js` | Add `totalScore`, `gamesPlayed`, `displayName` fields + index |
| `server/app.js` | Mount score routes |
| `server/controllers/authController.js` | Compute and store `displayName` on registration |
| `package.json` (root) | Add `@clerk/express` |

### Frontend — New Files
| File | Purpose |
|------|---------|
| `client/src/utils/questionGenerator.js` | generateRound(table) |
| `client/src/utils/scoring.js` | WEIGHT_MAP, getPointsPerCorrect, calculateRoundScore |
| `client/src/components/TableSelector/TableSelector.jsx` | Table grid UI |
| `client/src/components/TableSelector/table-selector.styles.scss` | Styles |
| `client/src/components/Leaderboard/Leaderboard.jsx` | Leaderboard display |
| `client/src/components/Leaderboard/leaderboard.styles.scss` | Styles |
| `client/src/hooks/useLeaderboard.js` | Fetch leaderboard |
| `client/src/hooks/useSubmitScore.js` | Submit score with JWT |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `client/src/Pages/Game/Game.jsx` | Remove sampledata; add table state; pass table to game component |
| `client/src/components/MultiplicationGame/MultiplicationGame.jsx` | Dynamic questions; weighted scoring; score submission; remove localStorage |
| `client/src/Pages/Home/Home.jsx` | Add Leaderboard component |

### Frontend — Deleted Files
| File | Reason |
|------|--------|
| `client/src/Pages/Game/sampledata.js` | Replaced by dynamic generation |

---

## Appendix — Phased Execution Plan

### Phase 1 — Backend foundation
_No frontend changes. No breaking changes to existing endpoints._

1. Install `@clerk/express` in root `package.json`
2. Add `CLERK_SECRET_KEY` to `.env`
3. Update `server/models/user.model.js` — add `totalScore`, `gamesPlayed`, `displayName` + index
4. Update `server/controllers/authController.js` — compute and store `displayName` on registration
5. Create `server/constants/scoring.js` — WEIGHT_MAP
6. Create `server/middleware/clerkAuth.js`
7. Create `server/controllers/scoreController.js` — `submitScore` and `getLeaderboard`
8. Create `server/routes/scoreRoutes.js`
9. Update `server/app.js` — mount routes at `/api/scores` and `/api/leaderboard`
10. Test both endpoints with curl/Postman
11. Deploy backend

### Phase 2 — Frontend utilities
_Pure logic, no UI changes yet. Write tests before integration._

12. Create `client/src/utils/scoring.js`
13. Create `client/src/utils/questionGenerator.js`
14. Write unit tests for both modules

### Phase 3 — Game refactor
_Wire up dynamic questions and score submission. Remove static data._

15. Create `client/src/components/TableSelector/TableSelector.jsx` + styles
16. Create `client/src/hooks/useSubmitScore.js`
17. Update `client/src/Pages/Game/Game.jsx` — integrate TableSelector, remove sampledata import
18. Update `client/src/components/MultiplicationGame/MultiplicationGame.jsx`:
    - Accept `table` prop; call `generateRound(table)` on start (reshuffled fresh each time)
    - Remove difficulty selector and `LEVELS` map; replace with single fixed 8-second timer
    - Replace flat +10 with `getPointsPerCorrect(table)`
    - Replace localStorage history with score submission hook
    - Remove `ChatHistory` rendering
    - Change `QUESTIONS_PER_GAME` to 12
19. Delete `client/src/Pages/Game/sampledata.js`

### Phase 4 — Leaderboard
_Additive. No existing code changes required._

20. Create `client/src/hooks/useLeaderboard.js`
21. Create `client/src/components/Leaderboard/Leaderboard.jsx` + styles
22. Update `client/src/Pages/Home/Home.jsx` — add `<Leaderboard />` below hero

### Phase 5 — QA and cleanup
23. End-to-end test: sign up → play → check leaderboard
24. Verify 401/404/400 error paths on score endpoint
25. (Optional) Remove Groq routes, `helper.js`, `systemPrompts.js`, `groq-sdk`
26. Deploy frontend
