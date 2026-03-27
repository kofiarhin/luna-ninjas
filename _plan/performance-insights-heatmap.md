# Performance Insights & Fact Heatmap

## Summary

Add a personal Performance Insights feature for authenticated users that tracks answer-level mastery across all multiplication facts. Each answered question during gameplay records whether the user got that specific fact right or wrong. Over time, this builds a per-fact mastery profile. The UI provides two views: a table-level summary (how strong is the user at their 7s, 8s, etc.) and a detailed heatmap grid showing every individual fact (7×8, 6×9, 12×4) with color-coded strength indicators. Guests can still play but never generate insight data.

## Goal

- Authenticated users can see their strengths and weaknesses across all multiplication facts
- Fact-level data is the source of truth; table summaries are derived from it
- Weak facts are visually obvious at a glance
- The feature integrates cleanly with the existing game flow without changing scoring or leaderboard logic

## Non-Goals

- AI-powered recommendations or suggestions
- Spaced repetition engine
- Adaptive difficulty engine
- Guest persistence of any kind
- Public sharing of insights
- Admin analytics dashboard
- Redesigning the game itself
- Tracking performance for LLM-generated questions (the `/api/questions` endpoint is not yet wired into the game loop)

## Problem

Users currently have no visibility into which multiplication facts they struggle with. The only feedback is aggregate: total score and games played. A user who consistently gets 7×8 wrong has no way to know that. The game becomes repetitive without targeted feedback on weak areas.

## Users / Actors

- **Authenticated user** — the only actor. Sees their own insights on a protected page.
- **Guest user** — can play the game but never generates insight data. If they navigate to the insights page, they are redirected to login (existing `PrivateRoute` behavior).

## Existing Repo Findings

### Question generation pattern

`generateRound(table)` in `client/src/utils/questionGenerator.js` creates 12 questions per round. Each question uses the format `(a, b)` where `a` is always the selected table (2–12) and `b` is a shuffled multiplier from 1–12. This means:

- Playing the **7s table** produces facts like 7×3, 7×8, 7×12
- Playing the **3s table** produces facts like 3×7, 3×8, 3×12
- The facts 7×3 and 3×7 are **mathematically identical** but appear in different rounds depending on which table the user selects

**Decision: merge commutative pairs.** Store facts as `(min(a,b), max(a,b))` so that 7×3 and 3×7 both count toward the same fact record. This gives users a unified view of their mastery for each mathematical fact regardless of which table they were practicing.

### Question log structure (already exists client-side)

Each entry in `questionLog` after a round:
```
{
  a: number,           // table
  b: number,           // multiplier
  correctAnswer: number,
  userAnswer: number | null,
  isCorrect: boolean,
  timeTaken: number | null,  // seconds (decimal)
  outcome: "correct" | "wrong" | "timeout"
}
```

This log is built during gameplay in `MultiplicationGame.jsx` but is currently **discarded after the round ends**. Only `{ table, correctCount }` is sent to the server. The full question log is the data source for this feature.

### Current score submission

`POST /api/scores` receives `{ table, correctCount }`. The server recomputes the round score and atomically increments `totalScore` and `gamesPlayed`. This endpoint does **not** receive or store per-question data.

### No existing history model

There is no game history collection, no per-round record, and no fact-level tracking anywhere in the backend. This feature requires a new data model.

## Data Model

### New collection: `FactMastery`

One document per (user, fact) pair. Updated incrementally over time.

**Schema: `server/models/factMastery.model.js`**

| Field | Type | Description |
|-------|------|-------------|
| `userId` | ObjectId (ref: User) | Required. The authenticated user |
| `factA` | Number | Required. `min(a, b)` — always the smaller operand (2–12) |
| `factB` | Number | Required. `max(a, b)` — always the larger operand (1–12) |
| `correct` | Number | Default 0. Total correct answers for this fact |
| `wrong` | Number | Default 0. Total wrong + timeout answers for this fact |
| `lastSeen` | Date | Last time this fact was answered |

**Indexes:**
- `{ userId: 1, factA: 1, factB: 1 }` — compound unique index. One record per user per fact.
- `{ userId: 1 }` — for fetching all facts for a user.

**Why this shape:**
- `correct` and `wrong` are sufficient to compute accuracy (`correct / (correct + wrong)`)
- `attempts` is derivable (`correct + wrong`) — no need to store separately
- `factA` is always `min(a, b)` and `factB` is always `max(a, b)` to enforce commutative merging at the database level
- `lastSeen` helps order facts by recency if needed later
- No `timeTaken` average stored in MVP. The client-side log tracks it, and it can be added to the schema later without migration. Out of scope for MVP display.

**Fact space:** Tables 2–12 × multipliers 1–12, merged commutatively, yields a finite set of unique facts. The maximum number of fact documents per user is bounded (roughly 78 unique facts for the 2–12 range).

### No changes to User schema

`totalScore` and `gamesPlayed` remain on the User document. Fact mastery is a separate collection, not embedded, because:
- The user document is fetched on every page load (`GET /api/auth/me`) — it should stay lean
- Fact mastery data is only needed on the insights page
- Separate collection allows efficient upserts with `$inc`

## Backend Changes

### New endpoint: `POST /api/insights/record`

**Auth:** requires `authMiddleware`

**Purpose:** Receives the full question log from a completed round and updates fact mastery records.

**Request body:**
```json
{
  "answers": [
    { "a": 7, "b": 3, "isCorrect": true },
    { "a": 7, "b": 8, "isCorrect": false },
    ...
  ]
}
```

**Validation:**
- `answers` must be an array with 1–12 entries
- Each entry must have `a` (integer 1–12), `b` (integer 1–12), `isCorrect` (boolean)
- Extra fields (userAnswer, timeTaken, outcome) are ignored server-side — only `a`, `b`, `isCorrect` matter

**Processing:**
1. For each answer, normalize: `factA = min(a, b)`, `factB = max(a, b)`
2. Group by `(factA, factB)` — a single round can theoretically have at most one entry per fact (since `generateRound` produces 12 unique multipliers), but grouping handles edge cases
3. For each unique fact, use `bulkWrite` with `updateOne` + `upsert: true`:
   - Filter: `{ userId, factA, factB }`
   - Update: `{ $inc: { correct: correctDelta, wrong: wrongDelta }, $set: { lastSeen: new Date() } }`
4. Return `{ recorded: true }`

**Why a separate endpoint from `POST /api/scores`:**
- Score submission is an atomic `$inc` on the User document — different collection, different concern
- Keeping them separate avoids making the existing score endpoint more complex
- The frontend can call both in parallel after a round ends
- If one fails, the other still succeeds

### New endpoint: `GET /api/insights`

**Auth:** requires `authMiddleware`

**Purpose:** Returns all fact mastery records for the authenticated user.

**Response:**
```json
{
  "facts": [
    { "factA": 3, "factB": 7, "correct": 12, "wrong": 3 },
    { "factA": 6, "factB": 9, "correct": 2, "wrong": 5 },
    ...
  ]
}
```

Returns raw fact data. The frontend computes accuracy, categories, and table summaries from this. This keeps the backend simple and the frontend in control of display logic.

**No data:** returns `{ facts: [] }` — the frontend handles the empty state.

### New route file: `server/routes/insightRoutes.js`

```
POST /api/insights/record  → authMiddleware → recordInsights
GET  /api/insights         → authMiddleware → getInsights
```

### Mount in `server/app.js`

Add: `app.use("/api/insights", insightRoutes)` alongside existing route mounts.

## Frontend Changes

### Gameplay recording (MultiplicationGame.jsx)

**When:** After the round ends, alongside the existing score submission.

**What changes in `finishGame()`:**
- Currently: calls `submitScore(correctCount)` if `user` is truthy
- After: also calls a new `recordAnswers(questionLog)` if `user` is truthy

**Data sent:** The `questionLog` array already contains `a`, `b`, and `isCorrect` for every question answered in the round. Map it to the minimal shape `{ a, b, isCorrect }` before sending.

**Avoiding double-counting:**
- `questionLog` is reset at the start of every round (`handleStartGame` sets it to `[]`)
- `finishGame` is called exactly once per round
- The log is built question-by-question during gameplay and is complete when `finishGame` fires
- No risk of double-counting within a round
- Across rounds, the server uses `$inc` — each round's answers add to the running totals, which is correct behavior

**Parallel submission:** `submitScore()` and `recordAnswers()` are independent. Call both without awaiting one before the other. If `recordAnswers` fails, the score still saves (and vice versa). The insights recording failure is silent — no error UI shown to the user for this call. The score submission error UI remains as-is.

### New hook: `client/src/hooks/useRecordInsights.js`

Encapsulates `POST /api/insights/record`:
- Reads `token` from `useAuth()`
- Accepts the question log array
- Maps entries to `{ a, b, isCorrect }`
- Fires the POST
- No loading/error UI needed — this is a fire-and-forget call
- Returns `{ record }` function

### New hook: `client/src/hooks/useInsights.js`

Encapsulates `GET /api/insights`:
- Reads `token` from `useAuth()`
- Fetches on mount
- Returns `{ facts, loading, error, refetch }`
- `facts` is the raw array from the server

### New page: `client/src/Pages/Insights/Insights.jsx`

Protected route at `/insights`. Contains two sections:

**1. Table Summary**

A row of cards (or horizontal scrollable list on mobile), one per table (2–12). Each card shows:
- Table number (e.g., "×7")
- Accuracy percentage (derived from all facts where `factA` or `factB` matches this table)
- Visual indicator (color-coded background or border)
- Attempt count (total answers for facts involving this table)

**Derivation logic (frontend):**
- For table `T`, find all fact records where `factA === T || factB === T`
- Sum `correct` and `wrong` across those records
- Accuracy = `sumCorrect / (sumCorrect + sumWrong) * 100`
- If `sumCorrect + sumWrong === 0`, show as "No data"

**2. Fact Heatmap Grid**

A 12×11 grid (rows: 1–12, columns: 2–12) or an 11×11 grid (rows: 2–12, columns: 2–12) — since tables start at 2, the grid should be rows 1–12 (multiplier) × columns 2–12 (table). Each cell represents one unique fact.

Because facts are stored commutatively (`factA = min, factB = max`), the grid only needs to render the upper triangle (where column ≥ row) or can render symmetrically. **Recommended: render the full grid** (both 7×3 and 3×7 cells point to the same data) for intuitive reading by the user. Both cells share the same color since they reference the same underlying fact record.

Each cell shows:
- Color-coded background based on mastery category
- Optional: accuracy percentage text inside the cell (on hover or always, depending on space)

### Mastery categories and colors

| Category | Rule | Color intent |
|----------|------|-------------|
| **Strong** | accuracy ≥ 80% AND attempts ≥ 5 | Green tint |
| **Mixed** | accuracy 50–79% AND attempts ≥ 5 | Yellow/amber tint |
| **Weak** | accuracy < 50% AND attempts ≥ 5 | Red tint |
| **Insufficient data** | attempts < 5 | Neutral/gray, distinct from "no data" |
| **No data** | attempts === 0 | Empty/very faint, no color |

**Threshold choice:** 5 attempts minimum before categorizing. Below that, the sample is too small to be meaningful. This is a product constant, not a user setting.

**Color tokens (aligned with app design system):**
- Strong: `rgba(52, 211, 153, 0.15)` border, `rgba(52, 211, 153, 0.08)` bg (green, matching `$green` from game styles)
- Mixed: `rgba(251, 191, 36, 0.15)` border, `rgba(251, 191, 36, 0.08)` bg (amber)
- Weak: `rgba(251, 113, 133, 0.15)` border, `rgba(251, 113, 133, 0.08)` bg (red, matching `$red`)
- Insufficient: `rgba(255, 255, 255, 0.04)` bg, dashed border
- No data: `rgba(255, 255, 255, 0.02)` bg, no border

### New style file: `client/src/Pages/Insights/insights.styles.scss`

Mobile-first. The heatmap grid should scroll horizontally on small screens. Table summary cards should be a scrollable horizontal row on mobile, wrapping grid on desktop.

### Routing

Add to `App.jsx`:
```
<Route path="/insights" element={<PrivateRoute><Insights /></PrivateRoute>} />
```

Guest behavior: `PrivateRoute` redirects to `/login`. No special empty state needed — the redirect is the existing pattern.

### Header navigation

Add an "Insights" link in the header nav for authenticated users, between "Game" and the user area. Follows the same `NavLink` pattern as the existing "Game" link.

## Gameplay Recording Rules

1. **Only authenticated users:** The `recordAnswers()` call is gated behind `if (user)`, same as `submitScore()`
2. **Only real gameplay answers:** Data comes from the `questionLog` built during actual play — not synthesized
3. **Per-round batch:** All 12 (or fewer, if lives ran out) answers from a round are sent in a single POST at round end
4. **Fire-and-forget:** Recording failure is silent. The user's game experience is unaffected
5. **Commutative normalization:** The server normalizes `(a, b)` → `(min, max)` before upserting
6. **No double-counting:** `questionLog` is reset at round start. `finishGame` fires once. Server uses `$inc` on upserted documents.
7. **Timeouts count as wrong:** `outcome === "timeout"` has `isCorrect: false`. Treated identically to a wrong answer for mastery tracking.

## Table Summary Rules

Computed entirely on the frontend from the raw `facts` array:

1. For each table `T` (2–12):
   - Collect all fact records where `factA === T` OR `factB === T`
   - Sum `correct` across those records → `totalCorrect`
   - Sum `wrong` across those records → `totalWrong`
   - `totalAttempts = totalCorrect + totalWrong`
   - `accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null`
2. Apply mastery category based on accuracy and total attempts (same thresholds as heatmap)
3. Sort tables 2–12 in numeric order

**Note:** A single fact (e.g., 3×7) contributes to both the ×3 summary and the ×7 summary. This is intentional — it reflects the user's experience when practicing either table.

## Fact Heatmap Rules

1. **Grid dimensions:** Columns = tables 2–12 (11 columns). Rows = multipliers 1–12 (12 rows).
2. **Cell lookup:** For cell at (row=`r`, col=`c`), look up fact record where `factA === min(r, c)` AND `factB === max(r, c)`
3. **Symmetric cells:** Cell (3, 7) and cell (7, 3) both reference the same fact record `(3, 7)`. Same color, same data.
4. **Diagonal:** Cells where row === col (e.g., 5×5) are valid facts with their own records.
5. **Below table range:** Row 1 combined with columns 2–12 produces facts like 1×2, 1×3, etc. These are trivially easy (answer equals the column). They will likely show as "strong" or "no data". Including them is fine — omitting row 1 is also acceptable as a simplification since the game generates multipliers 1–12 but users rarely struggle with ×1.
6. **Cell interaction:** On hover (desktop) or tap (mobile), show a tooltip/popover with: fact text (e.g., "7 × 8"), correct count, wrong count, accuracy percentage, attempt count.

## UI Placement

**Dedicated page at `/insights`.** Rationale:
- The insights view is data-heavy (11×12 grid + 11 table cards) — it needs its own page, not a section crammed into the profile
- Consistent with the app's routing pattern (each major feature = its own route)
- The header nav gets an "Insights" link for logged-in users, making it discoverable
- The profile page can optionally link to insights ("View your performance →") but the primary access is via the nav

## States and Edge Cases

| State | Behavior |
|-------|----------|
| **Loading** | Show skeleton/spinner while `GET /api/insights` is in flight |
| **Empty (no facts)** | Show friendly empty state: "Play some games to start building your performance profile" with a CTA button to `/game` |
| **Insufficient data (most cells)** | Cells show as neutral gray. Table summaries show "Not enough data" instead of accuracy. This is expected for new users — the page populates over time |
| **Unauthenticated** | `PrivateRoute` redirects to `/login`. No custom handling needed |
| **Recording failure** | Silent. User is not notified. Insights page shows slightly stale data — acceptable |
| **Score submission succeeds but recording fails** | Score and leaderboard are unaffected. Insights are slightly behind. No inconsistency visible to the user. |
| **User plays same table repeatedly** | Facts for that table accumulate more attempts. Other tables remain at low data. The heatmap clearly shows which areas have been practiced vs. not. |
| **Very high attempt counts** | No cap needed. `$inc` works at any scale. Accuracy naturally stabilizes. |
| **Multiple browser tabs** | Each round's recording is independent. No conflict — `$inc` is atomic. |
| **Network interruption during record** | Fire-and-forget means the user never sees an error. Data for that round is lost. Subsequent rounds still record. Acceptable for MVP. |

## Technical Notes

1. **`bulkWrite` for recording:** The `POST /api/insights/record` endpoint should use `Model.bulkWrite()` with `updateOne` + `upsert: true` operations for all facts in the round. This is a single database round-trip for up to 12 upserts.

2. **No transaction needed:** Each upsert is independent. Partial failure (some facts recorded, some not) is acceptable — the user won't notice one missing fact increment.

3. **Index ensures uniqueness:** The compound unique index on `(userId, factA, factB)` prevents duplicate fact documents. The `upsert` either creates or increments.

4. **Frontend derivation is cheap:** With at most ~78 fact documents per user, computing table summaries and grid data in JavaScript is negligible. No need for server-side aggregation pipelines.

5. **No new env vars needed.**

6. **`timeTaken` is intentionally excluded from MVP storage.** The question log already tracks it client-side, so the `answers` array could include it in the future without changing the recording flow — just add a field to the POST body and a field to the schema.

## File Impact

### Files Confirmed To Exist (To Update)

| File | Change |
|------|--------|
| `server/app.js` | Mount `insightRoutes` at `/api/insights` |
| `client/src/App.jsx` | Add `/insights` route with `PrivateRoute` wrapper, import `Insights` page |
| `client/src/components/Header/Header.jsx` | Add "Insights" nav link for authenticated users |
| `client/src/components/Header/header.styles.scss` | No structural change needed — existing `.header-link` class applies |
| `client/src/components/MultiplicationGame/MultiplicationGame.jsx` | Call `recordAnswers(questionLog)` in `finishGame()` alongside `submitScore()`, gated behind `if (user)` |

### Files To Create

| File | Purpose |
|------|---------|
| `server/models/factMastery.model.js` | Mongoose schema + model for FactMastery collection |
| `server/controllers/insightController.js` | `recordInsights` and `getInsights` controller functions |
| `server/routes/insightRoutes.js` | Route definitions for `/api/insights` |
| `client/src/Pages/Insights/Insights.jsx` | Insights page component with table summary + heatmap |
| `client/src/Pages/Insights/insights.styles.scss` | Styles for insights page (mobile-first) |
| `client/src/hooks/useRecordInsights.js` | Hook for `POST /api/insights/record` (fire-and-forget) |
| `client/src/hooks/useInsights.js` | Hook for `GET /api/insights` (fetch on mount) |

### Files Not Changed

| File | Reason |
|------|--------|
| `server/models/user.model.js` | No schema changes — fact mastery is a separate collection |
| `server/controllers/scoreController.js` | Score submission unchanged |
| `server/routes/scoreRoutes.js` | No changes |
| `client/src/hooks/useSubmitScore.js` | No changes |
| `client/src/context/AuthContext.jsx` | No changes — insights don't affect auth state |
| `client/src/utils/questionGenerator.js` | No changes |
| `client/src/utils/scoring.js` | No changes |

## Acceptance Criteria

- [ ] New `FactMastery` model exists with `userId`, `factA`, `factB`, `correct`, `wrong`, `lastSeen` fields
- [ ] Compound unique index on `(userId, factA, factB)` prevents duplicate fact records
- [ ] `POST /api/insights/record` accepts an `answers` array and upserts fact mastery records
- [ ] `POST /api/insights/record` normalizes facts commutatively: `factA = min(a, b)`, `factB = max(a, b)`
- [ ] `POST /api/insights/record` returns 401 without a valid JWT
- [ ] `POST /api/insights/record` validates answer entries (a and b are 1–12 integers, isCorrect is boolean)
- [ ] `GET /api/insights` returns all fact records for the authenticated user
- [ ] `GET /api/insights` returns 401 without a valid JWT
- [ ] `GET /api/insights` returns `{ facts: [] }` for users with no recorded data
- [ ] After a game round, authenticated users' answer data is sent to `POST /api/insights/record`
- [ ] Guest users' answer data is never sent to the server
- [ ] Recording failure does not affect score submission or game UX
- [ ] `/insights` route exists and is protected by `PrivateRoute`
- [ ] Unauthenticated users are redirected to `/login` when visiting `/insights`
- [ ] Insights page shows table-level summary cards for tables 2–12
- [ ] Table summaries are derived from fact-level data, not stored separately
- [ ] Insights page shows a heatmap grid of individual facts
- [ ] Heatmap cells are color-coded: green (strong ≥ 80%), amber (mixed 50–79%), red (weak < 50%), gray (insufficient < 5 attempts), faint (no data)
- [ ] Commutative cells (e.g., 3×7 and 7×3) show identical data and color
- [ ] Cells with fewer than 5 attempts show as "insufficient data", not categorized
- [ ] Hovering/tapping a cell shows fact details (correct, wrong, accuracy, attempts)
- [ ] Empty state shows when no facts have been recorded, with CTA to play
- [ ] Loading state shows while data is being fetched
- [ ] Header nav shows "Insights" link for authenticated users
- [ ] Insights page is responsive (heatmap scrolls horizontally on mobile)
- [ ] Timeouts are counted as wrong answers in mastery tracking

## Open Questions

- None at this stage.

## Assumptions

- The game will continue to use `generateRound(table)` which produces `(table, multiplier)` pairs. If the LLM question generation is wired in later (it currently isn't), a separate recording path may be needed — but that is out of scope.
- 5 attempts is a reasonable minimum threshold for categorization. This can be adjusted later as a constant without schema changes.
- Users are unlikely to have more than ~78 unique fact records (the full 2–12 × 1–12 commutative space). This keeps frontend computation trivial.
