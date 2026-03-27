# Public Gameplay, Auth-Only Leaderboard

## Summary

Make the game playable by anyone (guest or authenticated) by removing the `PrivateRoute` guard on `/game`. Guests can play the full game but their scores are not saved and do not appear on the leaderboard. Authenticated users retain the current behavior: scores are persisted server-side and contribute to leaderboard rankings. The leaderboard gains a display name fallback chain (`displayName → username → fullName`) so no entry ever renders as blank.

## Goal

- Anyone visiting `/game` can play immediately without signing up
- Only authenticated users have scores saved and appear on the leaderboard
- Leaderboard integrity is maintained entirely server-side — no client-side trust
- Leaderboard never shows a blank name

## Non-Goals

- Guest user accounts or anonymous identifiers
- Persisting guest scores locally (localStorage) across sessions
- Guest game history or stats tracking of any kind
- Prompting guests to sign up mid-game (may be added later, not in this spec)
- Changing the game mechanics, timer, lives, or scoring formula
- Changing how the leaderboard is sorted or how many entries it shows
- Adding a game history model or per-game records

## Problem

The game is currently locked behind authentication (`PrivateRoute`). Users must register before they can even try the game, which creates friction and discourages casual visitors. Additionally, the leaderboard only uses `displayName` with no fallback, so users who registered without setting a display name (or who cleared it) could appear as blank rows.

## Users / Actors

- **Guest user** — unauthenticated visitor who can play the game but has no persistent identity
- **Authenticated user** — logged-in user whose scores are saved and who appears on the leaderboard

## Existing Repo Findings

### Current behavior

| Area | Current state |
|------|---------------|
| **Route** | `/game` is wrapped in `PrivateRoute` in `App.jsx` — redirects to `/login` if `!user` |
| **Game component** | `MultiplicationGame.jsx` calls `useSubmitScore` on game over unconditionally |
| **useSubmitScore** | Reads `token` from `useAuth()`. POSTs to `/api/scores` with `Authorization: Bearer ${token}`. If token is missing/null, the request would fail with 401 |
| **POST /api/scores** | Gated by `authMiddleware`. Extracts `req.auth.userId`, finds user, atomically increments `totalScore` and `gamesPlayed`. Returns 404 if user not found |
| **GET /api/leaderboard** | Public. Queries `User.find({ totalScore: { $gt: 0 } })`, projects only `displayName totalScore gamesPlayed`, returns top 20 |
| **Leaderboard display** | Shows `leader.displayName` directly — no fallback if empty |
| **User schema** | `displayName` defaults to `""`. Set to `fullName` at registration. No guarantee it stays non-empty after profile edits |
| **safeUser()** | Returns `_id, displayName, email, username, fullName, profileImage` |

### Inconsistencies / weak patterns found

1. **No fallback on leaderboard name.** `getLeaderboard` projects only `displayName`. If a user clears their `displayName` via profile edit, they appear as a blank row. This is a data integrity gap.

2. **`useSubmitScore` doesn't check for auth before calling.** It reads `token` from context and sends it, but if `token` is `null` (guest), the fetch will fire and return 401. The hook doesn't short-circuit — it just surfaces the error. This works but is wasteful (unnecessary network call) and shows an error message to guests.

3. **`MultiplicationGame` always calls `submit()` on game over.** There's no conditional check for auth state. The submit call, loading state, success/error UI, and retry button all render regardless of whether the user is logged in.

4. **Leaderboard component shows `displayName` only.** The backend doesn't send `username` or `fullName` as fallback candidates.

## Proposed Behavior

### Route change

Remove the `PrivateRoute` wrapper from `/game`. The route becomes public. The `PrivateRoute` component itself stays — it's used by `/profile` and potentially other routes.

### Guest gameplay

- Guest can navigate to `/game`, select a table, and play a full round
- Game mechanics are identical: 12 questions, 8s timer, 5 lives, streak bonuses, animations, sounds
- Score is calculated and displayed locally during and after the round (the client-side `calculateRoundScore` still runs)
- **Score is NOT submitted to the backend.** The `useSubmitScore` hook is not called at all for guests.
- GameSummary still shows final score, accuracy, lives remaining, and questions answered — these are all local state
- No "score saved" / "score failed" / retry UI shown for guests
- Instead, after the game summary, show a subtle prompt: "Sign in to save your scores and appear on the leaderboard" with a link to `/login`

### Authenticated gameplay

- No change from current behavior
- Score is submitted via `POST /api/scores` as today
- Success/error/retry UI shown as today
- Results persist to `totalScore` and `gamesPlayed` on the User document

### Leaderboard

- Backend query expands to include `username` and `fullName` in the projection
- Backend computes a `name` field using fallback chain: `displayName || username || fullName`
- Users where all three are empty/falsy are excluded from results (added to the query filter)
- Frontend displays the computed `name` field — no fallback logic needed client-side
- Leaderboard remains public (`GET /api/leaderboard` has no auth requirement)

## Core Requirements

1. `/game` route is public — no `PrivateRoute` wrapper
2. Game mechanics are identical for guests and authenticated users
3. Guest score is displayed locally but never submitted to the backend
4. `useSubmitScore` is only called when `user` is truthy in `AuthContext`
5. GameSummary renders differently for guests vs authenticated users (no save status for guests, sign-in prompt instead)
6. `POST /api/scores` remains auth-gated — no backend change needed for this endpoint
7. `GET /api/leaderboard` returns a computed `name` field with fallback: `displayName || username || fullName`
8. Leaderboard excludes users where all name fields are empty
9. Leaderboard never returns a blank name to the frontend
10. No new API endpoints needed

## User Flows

### Guest plays a game

1. Guest visits `/game` (no redirect)
2. Selects a multiplication table
3. Plays 12 questions with timer, lives, streaks — identical to authenticated flow
4. Game ends (all questions answered or lives exhausted)
5. GameSummary shows: score, accuracy, lives remaining, questions answered
6. Below summary: "Sign in to save your scores and appear on the leaderboard" with link to `/login` and link to `/register`
7. "Play Again" button works as normal — returns to table selection

### Authenticated user plays a game

1. User visits `/game` (no redirect — they're already logged in)
2. Selects a multiplication table
3. Plays 12 questions — identical experience
4. Game ends
5. Score submitted via `POST /api/scores` — loading → success/error UI shown
6. GameSummary shows: score, accuracy, lives, questions answered, save status
7. "Play Again" button works as normal

### Leaderboard viewed by anyone

1. User (guest or authenticated) views leaderboard component
2. `GET /api/leaderboard` returns top 20 with computed `name` field
3. No blank names ever appear
4. Display unchanged otherwise (rank, name, score)

## Functional Details

### Frontend — Routing (`App.jsx`)

Remove the `PrivateRoute` wrapper from the `/game` route:

**Before:** `<Route path="/game" element={<PrivateRoute><Game /></PrivateRoute>} />`
**After:** `<Route path="/game" element={<Game />} />`

### Frontend — MultiplicationGame (`MultiplicationGame.jsx`)

This is the main change area. The component currently calls `submit()` unconditionally on game over.

**Changes needed:**

1. Read `user` from `useAuth()` at the top of the component (it currently only uses `useSubmitScore` which internally reads `token`)
2. On game over, only call `submit()` if `user` is truthy
3. Pass `isAuthenticated` (derived from `!!user`) to the GameSummary rendering section
4. When `!user`:
   - Do not render score submission loading/success/error/retry UI
   - Render a guest prompt block instead (see below)

**Guest prompt block** (rendered inside the existing game-over/summary section):

A styled container with:
- Text: "Want to save your scores?"
- Subtext: "Sign in to track your progress and compete on the leaderboard"
- Two links/buttons: "Sign in" → `/login`, "Create account" → `/register`
- Styled consistently with the game's dark theme and accent colors

The `useSubmitScore` hook can still be called at the top level (hooks can't be conditional), but `submit()` must only be invoked when authenticated. Alternatively, the hook can be refactored to accept a `skip` flag or the submit call can simply be gated by an `if (user)` check before calling `submit()`.

### Frontend — useSubmitScore (`hooks/useSubmitScore.js`)

**Minimal change option (preferred):** No changes to the hook itself. The gating happens in `MultiplicationGame.jsx` where `submit()` is called. If `user` is null, `submit()` is never called, so the hook's internal fetch never fires.

**Alternative (optional hardening):** Add an early return in the hook's `submit` function if `token` is falsy:
```
if (!token) return; // guest — skip silently
```
This is a safety net, not the primary gate.

### Frontend — Leaderboard component (`Leaderboard.jsx`)

Change `leader.displayName` to `leader.name` in the render. The backend now returns `name` as a computed field.

### Frontend — useLeaderboard hook (`hooks/useLeaderboard.js`)

No changes needed. The hook already returns whatever the backend sends. The `name` field will be available automatically.

### Backend — Score controller (`controllers/scoreController.js`)

**`getLeaderboard` function changes:**

1. Expand the `.select()` to include `displayName username fullName totalScore gamesPlayed`
2. Add a filter condition to exclude users with no usable name:
   - Query: `{ totalScore: { $gt: 0 }, $or: [{ displayName: { $ne: "" } }, { username: { $exists: true, $ne: null } }, { fullName: { $ne: "" } }] }`
   - This is a safety net — in practice, `fullName` is required at registration, so this filter should never exclude anyone. But it prevents blank entries if data is somehow corrupted.
3. Map results to compute the `name` field:
   ```
   name: user.displayName || user.username || user.fullName
   ```
4. Return `{ rank, name, totalScore, gamesPlayed }` instead of `{ rank, displayName, totalScore, gamesPlayed }`

**`submitScore` function:** No changes. It's already auth-gated and validates server-side.

### Backend — No other changes

- `authMiddleware.js` — unchanged
- `authRoutes.js` — unchanged
- `scoreRoutes.js` — unchanged
- `user.model.js` — unchanged
- `app.js` — unchanged
- `scoring.js` (constants) — unchanged

## Leaderboard Eligibility Rules

| Rule | Enforced by |
|------|-------------|
| User must be authenticated | `authMiddleware` on `POST /api/scores` — guests can't submit |
| Score must be recomputed server-side | `scoreController.submitScore` uses `WEIGHT_MAP`, never trusts client score |
| User must have `totalScore > 0` | `getLeaderboard` query filter |
| User must have at least one non-empty name field | `getLeaderboard` query filter |
| Top 20 only | `.limit(20)` in query |
| Sorted by totalScore desc, then createdAt asc | `.sort({ totalScore: -1, createdAt: 1 })` |

Guest users cannot appear on the leaderboard because:
1. They cannot call `POST /api/scores` (no JWT → 401)
2. Even if they somehow sent a request, `authMiddleware` rejects it before the controller runs
3. There is no User document for a guest, so there's nothing to increment

## Leaderboard Display Name Rules

**Fallback chain (computed server-side):**

1. `displayName` — user's chosen display name (may be empty string)
2. `username` — may be `undefined`/`null` (optional at registration)
3. `fullName` — required at registration, should always exist

**Edge case:** If all three are somehow empty/falsy (data corruption), the user is excluded from leaderboard results entirely. This is safer than showing a blank row.

**Where computed:** Server-side in `getLeaderboard`, not client-side. The frontend receives a pre-computed `name` field and renders it directly. This keeps the logic centralized and prevents client-side display bugs.

## Guest vs Authenticated Flow Comparison

| Aspect | Guest | Authenticated |
|--------|-------|---------------|
| Can access `/game` | Yes | Yes |
| Can select table | Yes | Yes |
| Game mechanics | Identical | Identical |
| Local score display during game | Yes | Yes |
| Local GameSummary stats | Yes | Yes |
| Score submitted to backend | **No** | Yes |
| `POST /api/scores` called | **No** | Yes |
| Score save status UI | **Not shown** | Shown (loading/success/error/retry) |
| Guest prompt shown | **Yes** (sign-in CTA) | Not shown |
| Score persists across sessions | **No** | Yes |
| Appears on leaderboard | **No** | Yes (if totalScore > 0) |
| Play Again works | Yes | Yes |

## API Contract Impact

### `POST /api/scores` — No change

Request/response unchanged. Still auth-gated. The only difference is that guest clients never call it.

### `GET /api/leaderboard` — Response shape change

**Before:**
```json
[
  { "rank": 1, "displayName": "Jane", "totalScore": 450, "gamesPlayed": 12 }
]
```

**After:**
```json
[
  { "rank": 1, "name": "Jane", "totalScore": 450, "gamesPlayed": 12 }
]
```

**Breaking change:** The field is renamed from `displayName` to `name`. The Leaderboard component must be updated to use `leader.name`. No other consumers exist.

## States and Edge Cases

| State / Edge case | Handling |
|-------------------|----------|
| Guest on `/game` | Game loads normally, no redirect |
| Guest completes game | Summary shown, no score submission, sign-in prompt displayed |
| Guest clicks "Play Again" | Returns to table selection as normal |
| Authenticated user's token expires mid-game | `useSubmitScore` returns 401 error — existing error UI handles this ("Session expired") |
| User signs in on another tab during guest game | No effect on current tab — `AuthContext` doesn't cross tabs. Game stays in guest mode until page reload |
| User with empty displayName on leaderboard | Falls back to `username`, then `fullName` |
| User with all name fields empty | Excluded from leaderboard results |
| `displayName` set to whitespace only | Current schema doesn't trim on save. The `||` fallback treats `"  "` as truthy, so it would show whitespace. **Recommendation:** trim `displayName` in the leaderboard map step: `(user.displayName || "").trim() || user.username || user.fullName`. This is a minor defensive addition. |
| Leaderboard fetched by guest | Works — endpoint is public, no change |
| Guest tries to manually POST to `/api/scores` | 401 from `authMiddleware` — no score saved |
| Guest with DevTools modifies client code to call submit | 401 from server — integrity maintained server-side |

## Technical Notes

1. **No new dependencies or env vars.** This is purely a routing + conditional logic change on the frontend, and a minor query/projection change on the backend.

2. **`useSubmitScore` hook is always called** (React hooks rules), but `submit()` is only invoked conditionally. This is the standard React pattern for conditional side effects.

3. **The leaderboard `displayName → name` rename is the only backend contract change.** It's a minor rename but the Leaderboard component must be updated in the same PR to avoid a broken UI.

4. **No localStorage or sessionStorage for guest scores.** When the guest leaves or refreshes, their game state is gone. This is intentional — no ghost data.

5. **The guest prompt in GameSummary should be a simple inline block**, not a modal or popup. It should feel like helpful context, not an aggressive upsell gate.

6. **The `PrivateRoute` component stays.** It's still used by `/profile`. Only the `/game` route's usage of it is removed.

## File Impact

### Files Confirmed To Exist (To Update)

| File | Change |
|------|--------|
| `client/src/App.jsx` | Remove `PrivateRoute` wrapper from `/game` route |
| `client/src/components/MultiplicationGame/MultiplicationGame.jsx` | Read `user` from `useAuth()`. Gate `submit()` call behind `if (user)`. Conditionally render score-save UI vs guest prompt based on auth state |
| `client/src/components/Leaderboard/Leaderboard.jsx` | Change `leader.displayName` to `leader.name` |
| `server/controllers/scoreController.js` | Update `getLeaderboard`: expand select, add name fallback computation, filter out blank-name users, return `name` instead of `displayName` |

### Files To Create

None. No new files needed.

### Files Not Changed

| File | Reason |
|------|--------|
| `client/src/hooks/useSubmitScore.js` | No change — gating happens at call site |
| `client/src/hooks/useLeaderboard.js` | No change — passes through whatever backend returns |
| `client/src/Pages/Game/Game.jsx` | No change — just renders TableSelector/MultiplicationGame |
| `client/src/components/GameSummary/GameSummary.jsx` | No change — receives props, doesn't know about auth. The conditional rendering happens in MultiplicationGame |
| `client/src/components/GameHeader/GameHeader.jsx` | No change |
| `client/src/components/TableSelector/TableSelector.jsx` | No change |
| `client/src/utils/scoring.js` | No change |
| `client/src/utils/questionGenerator.js` | No change |
| `server/routes/scoreRoutes.js` | No change |
| `server/constants/scoring.js` | No change |
| `server/middleware/authMiddleware.js` | No change |
| `server/models/user.model.js` | No change |
| `server/app.js` | No change |
| `client/src/context/AuthContext.jsx` | No change |

## Acceptance Criteria

- [ ] `/game` route loads without authentication — no redirect to `/login`
- [ ] Guest can select a table and play a full round of 12 questions
- [ ] Game mechanics (timer, lives, streaks, scoring display) are identical for guests and authenticated users
- [ ] GameSummary shows score, accuracy, lives, and questions answered for guests
- [ ] No network request to `POST /api/scores` is made when a guest completes a game
- [ ] No score submission loading/success/error/retry UI is shown to guests
- [ ] A sign-in prompt with links to `/login` and `/register` is shown to guests after game over
- [ ] Authenticated user's score is still submitted via `POST /api/scores` on game over
- [ ] Authenticated user sees score save status (loading/success/error) as before
- [ ] `POST /api/scores` still returns 401 for requests without a valid JWT
- [ ] Leaderboard displays `name` field (not raw `displayName`)
- [ ] Leaderboard name uses fallback: `displayName → username → fullName`
- [ ] Leaderboard never shows a blank/empty name
- [ ] Users with all name fields empty are excluded from leaderboard results
- [ ] Leaderboard endpoint remains public (no auth required to view)
- [ ] "Play Again" works identically for guests and authenticated users
- [ ] `PrivateRoute` still protects `/profile`

## Open Questions

- None at this stage.

## Assumptions

- `fullName` is reliably non-empty for all existing users (it's required at registration). The blank-name exclusion filter is a safety net, not expected to filter real users.
- No product requirement exists for prompting guests to sign up mid-game (e.g., after question 6). This can be added later as a separate feature.
- Guest score display in GameSummary is ephemeral — there's no expectation to show "your best guest score" or persist anything locally.
