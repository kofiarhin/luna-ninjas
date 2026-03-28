# Guest Post-Game Login Save

## Summary

When a guest finishes a round and sees the game summary, they currently see CTAs to sign in or create an account — but navigating to those pages discards their just-finished result. This feature preserves the completed guest result in `sessionStorage` at the moment the round ends, and after successful login or registration automatically submits that result to the authenticated account without requiring the player to replay the round.

---

## Goal

A guest who finishes any standard round and then signs in or registers immediately after will have that just-finished result saved to their account — score and insights — without losing it or replaying the round.

---

## Non-Goals

- No login requirement before gameplay.
- No changes to the authenticated end-of-game save flow.
- No changes to pause or quit behavior.
- No backend changes — existing score and insights API contracts are sufficient.
- No saving of smart practice rounds (guests already cannot start smart practice; the pre-game gate is unchanged).
- No post-save "Score saved" banner or modified summary screen on return to `/game` (this is an enhancement that can be addressed separately).
- No cross-session persistence — the pending result is intentionally one tab-session only.
- No changes to leaderboard, profile, or insights pages.

---

## Problem

Guest players may be motivated to sign up or log in immediately after finishing a well-played round. Today, that conversion costs them their result. The friction of "I signed up but my score wasn't saved" is avoidable and is a direct conversion barrier.

---

## Users / Actors

- **Guest player** — unauthenticated user who has just completed a standard game round (normal completion or early quit) and is looking at the game summary.

---

## Core Requirements

1. When a guest finishes a round (normal or early quit), the just-finished result is written to `sessionStorage` under `luna_pending_result`.
2. The guest-over CTA copy is updated from the generic "Want to save your scores?" to copy explicitly tied to the just-finished result (e.g. the score they just earned).
3. When a guest starts a new game round, any existing `luna_pending_result` in `sessionStorage` is cleared so stale data cannot be saved by a later login.
4. After successful login on `/login`, if `luna_pending_result` exists in `sessionStorage`, the pending score is submitted to `POST /api/scores` using the freshly returned token before navigating.
5. After successful registration on `/register`, the same pending result check and save is performed before navigating.
6. After a successful pending save, `luna_pending_result` is removed from `sessionStorage` to prevent duplicate submissions.
7. Both score submission (`POST /api/scores`) and insights recording (`POST /api/insights/record`) are attempted after auth. Insights recording is fire-and-forget; failure does not block navigation.
8. If the score submission fails after auth, the login/register page displays an error with a retry option. The user remains on the auth page; the pending result stays in `sessionStorage` so retry is possible without re-entering credentials.
9. After a successful pending save, both login and register pages navigate to `/game` as usual.
10. The feature applies to all standard rounds regardless of operation (multiplication or division) and regardless of whether the round was a quick-launch session.

---

## User Flows

### Flow A — Guest completes round, signs in to save

1. Guest plays a standard multiplication or division round.
2. Round ends (all questions answered, lives exhausted, or early quit via Quit button).
3. `finishGame` runs. Because `!user`, pending result is written to `sessionStorage`.
4. `GameSummary` renders with the just-finished score. The `.mg__guest` block shows updated copy referencing the earned score.
5. Guest clicks "Sign in". The `<Link to="/login">` navigates normally (pending result is already in `sessionStorage`).
6. Guest submits credentials. Login succeeds; server returns `{ token, user }`.
7. `Login.jsx` calls `login(token, user)` (normal flow). Then reads `luna_pending_result` from `sessionStorage`.
8. If present: calls `POST /api/scores` with the pending payload and `Authorization: Bearer <data.token>`.
9. If score save succeeds: fires `POST /api/insights/record` (fire-and-forget). Removes `luna_pending_result` from `sessionStorage`. Navigates to `/game`.
10. If score save fails: shows error message with a Retry button. User stays on `/login`. `luna_pending_result` is not cleared.

### Flow B — Guest completes round, creates account to save

1–4. Same as Flow A steps 1–4.
5. Guest clicks "Create account". Navigates to `/register`. Pending result is in `sessionStorage`.
6. Guest completes registration form. Register succeeds; server returns `{ token, user }`.
7. `Register.jsx` calls `login(token, user)`. Reads `luna_pending_result` from `sessionStorage`.
8–10. Same save logic as Flow A steps 8–10.

### Flow C — Guest navigates from login to register (or back) while pending result exists

1. Guest is on `/login` with `luna_pending_result` in `sessionStorage`.
2. Guest clicks "Create one" link to go to `/register`.
3. No special handling needed — `luna_pending_result` remains in `sessionStorage` throughout the tab session.
4. Guest registers; Flow B step 6 onwards applies.

### Flow D — Guest plays a second round before logging in

1. `luna_pending_result` exists in `sessionStorage` from a prior round.
2. Guest clicks "Play Again". `handleStartGame` runs in `MultiplicationGame.jsx`.
3. `handleStartGame` removes `luna_pending_result` from `sessionStorage`.
4. New round begins. Only the newly completed round will be saved on next login.

### Flow E — Guest refreshes the browser on the login page mid-flow

1. `luna_pending_result` exists in `sessionStorage`.
2. Guest refreshes `/login`. `sessionStorage` is not cleared by a reload (unlike React state or `location.state`).
3. Pending result is still present when the guest completes login. Flow A continues from step 6.

---

## Functional Details

### sessionStorage payload — `luna_pending_result`

Written as JSON. All fields are required for save parity with an authenticated round:

```json
{
  "sessionId": 1711628400000,
  "table": 7,
  "operation": "multiplication",
  "correctCount": 9,
  "questionLog": [
    { "a": 7, "b": 3, "correctAnswer": 21, "userAnswer": 21, "isCorrect": true, "timeTaken": 3.2, "outcome": "correct", "operation": "multiplication" }
  ],
  "isEarlyQuit": false
}
```

- `sessionId`: taken from `lastGameSummary.id` (already `Date.now()` at `finishGame`). Used for human-readable dedup logging and to ensure the write was for this specific round.
- `table` and `operation`: required by `POST /api/scores`.
- `correctCount`: required by `POST /api/scores`. Server recomputes authoritative score.
- `questionLog`: required by `POST /api/insights/record`. Each entry already carries `operation`.
- `isEarlyQuit`: informational only — does not change the save payload but preserves fidelity.

### When `luna_pending_result` is written

In `MultiplicationGame.jsx` → `finishGame`, inside the `if (!user)` branch immediately after `setLastGameSummary(summary)`. The payload is assembled from values in scope at that point: `table`, `operation`, `correctCount` (derived from `updatedLog`), the full `updatedLog`, and `isEarlyQuit` (from the `isEarlyQuit` ref, which is set to `true` by `handleConfirmQuit` before `finishGame` is called).

### When `luna_pending_result` is cleared

| Trigger | Action |
|---|---|
| Score save succeeds (after login or register) | `sessionStorage.removeItem("luna_pending_result")` |
| Score save fails (after login or register) | Leave in place — retry is possible |
| `handleStartGame` runs | `sessionStorage.removeItem("luna_pending_result")` — clears any stale result before a new round |

`luna_pending_result` is never cleared on page load, on auth context mount, or on logout — these would destroy retry ability.

### Score submission in Login.jsx / Register.jsx

After `login(data.token, data.user)` is called:

1. Read `sessionStorage.getItem("luna_pending_result")`. Parse JSON.
2. If null or parse fails: no pending result — proceed to `navigate("/game")` as today.
3. If present: call `POST /api/scores` directly with `fetch` using `data.token` (the token from the server response, not from React context, which has not yet re-rendered). Payload: `{ table, correctCount, operation }`.
4. If score API returns 2xx: fire `POST /api/insights/record` with `fetch` using `data.token` (fire-and-forget, catch errors silently). Remove `luna_pending_result` from sessionStorage. Navigate to `/game`.
5. If score API returns non-2xx or throws: set an error state (e.g. `"Could not save your score — please try again."`) with a Retry button visible. Do not navigate. Do not clear sessionStorage.
6. Retry: re-attempts step 3 using the same in-memory `data.token` (available in closure scope).

Score and insights calls are made with `fetch` directly in Login.jsx/Register.jsx — not via the `useSubmitScore` / `useRecordInsights` hooks — because those hooks read `token` from React context, which may not have re-rendered yet when the save is attempted synchronously after `login(token, user)`.

### Guest CTA copy update — `MultiplicationGame.jsx` game-over section

**Current:**
```
"Want to save your scores?"
"Sign in to track your progress and compete on the leaderboard"
```

**Updated:**
```
"Log in to save this result"
"You scored {lastGameSummary.score} — sign in to save it to your account and appear on the leaderboard."
```

`lastGameSummary` is already in scope in the game-over block, so `lastGameSummary.score` is available. The `<Link>` elements remain unchanged — no need to move to programmatic `navigate`.

### Interaction with round types

| Round type | Behaviour |
|---|---|
| Standard (multiplication / division) | Fully supported |
| Smart practice | Guests cannot start smart practice (existing pre-game gate unchanged). No pending result is written. |
| Early quit | Supported. `isEarlyQuit: true` is preserved in the payload. Score is submitted as normal (same as authenticated early-quit behaviour). |
| Quick-launch | Supported. Quick-launch sets `isQuickLaunch` and `practiceTarget` in `Game.jsx`, but the game itself is a standard round in `MultiplicationGame`. Pending result is written normally. |

---

## States and Edge Cases

| State | Handling |
|---|---|
| Guest plays two rounds before logging in | Second round's `handleStartGame` clears first round's pending result. Only the most recent round is saved. |
| Guest refreshes on login page | `sessionStorage` persists through reload. Pending result is still available. |
| Guest closes tab and opens a new one | `sessionStorage` is per-tab — cleared on tab close. No pending result in new tab. Intentional: one-session only. |
| Auth succeeds but score API returns 401 | Token just issued — this should not happen under normal conditions. Show error. Session token is valid (just returned by server). Retry should succeed. |
| Auth succeeds but score API returns 404 (user not found) | Should not happen — user was just created/found. Show error. |
| Auth succeeds but network is down | Fetch throws. Show error with retry. Pending result stays in sessionStorage. |
| Insights record fails | Silent. Same behaviour as existing authenticated flow. Proceed to navigate. |
| `luna_pending_result` in sessionStorage is malformed JSON | Catch parse error, skip save, proceed to navigate normally. |
| User is already authenticated and navigates to `/login` or `/register` | Login/Register pages currently do not redirect authenticated users. This is a pre-existing behaviour. The pending result check runs but `luna_pending_result` should not be present (written only for guests at `finishGame`). Edge case: authenticated user somehow has stale sessionStorage data — guard by also checking that user was not already authenticated before submitting. |
| Multiple rapid login attempts (double-submit) | The pending result is cleared in sessionStorage before navigate. If a second submit fires before the first removes the item, the worst case is two identical score submissions — server applies `$inc` additively. To prevent this, set a `savingPending` boolean flag in component state as a guard. |
| Guest navigates directly to `/login` without finishing a game | No `luna_pending_result` in sessionStorage. After login, pending check returns null. Navigate to `/game` as today. |

---

## Technical Notes

- **No backend changes required.** `POST /api/scores` and `POST /api/insights/record` already accept the required payloads and accept `Authorization: Bearer <token>`. Score is recomputed server-side.
- **Token timing.** Use `data.token` from the login/register API response directly, not `token` from `useAuth()`. The context update is async; `data.token` is available synchronously in the same handler scope.
- **`useSubmitScore` and `useRecordInsights` hooks are not used** for the pending save. They read token from context (which may lag). Make direct `fetch` calls with `data.token` in Login.jsx and Register.jsx.
- **`isEarlyQuit` in `finishGame`.** The `isEarlyQuit` state is set by `handleConfirmQuit` before `finishGame` is called. However, React state is asynchronous — `isEarlyQuit` at the time `finishGame` executes inside `handleConfirmQuit` may still be the previous value. Read from a ref or pass as a parameter to `finishGame` if needed. The existing `isEarlyQuit` state in the component was set by the prior `setIsEarlyQuit(true)` call in `handleConfirmQuit`; the pending result write happens at the same synchronous call site so the local `isEarlyQuit` variable should be used explicitly (pass it as an argument to `finishGame` or capture it inline), rather than reading the state variable.
- **`finishGame` signature.** Currently `finishGame(nextQuestionIndex, nextLives, nextScore, updatedLog)`. Adding a fifth `earlyQuit` parameter is the cleanest extension. `handleConfirmQuit` passes `true`; all other callers pass `false`.
- **`pendingScoreRef` already exists.** `MultiplicationGame.jsx` already uses `pendingScoreRef` for authenticated retry. The guest pending result in sessionStorage is separate and does not use this ref.
- **No new frontend test infra.** `client/package.json` contains no test runner (no Jest, Vitest, or testing-library). Frontend automated tests are deferred until test infrastructure is added. Server-side contracts are unchanged; no new server tests are required.

---

## Acceptance Criteria

- [ ] A guest who finishes a standard round and then logs in sees their just-finished score attributed to their account (totalScore incremented, visible on leaderboard if high enough).
- [ ] A guest who finishes a standard round and then registers sees their just-finished score attributed to their new account.
- [ ] A guest who finishes an early-quit round and then logs in has that partial result saved (same as authenticated early-quit behaviour).
- [ ] The guest game-over CTA shows copy tied to the just-finished score, not generic copy.
- [ ] If the player plays a second guest round before logging in, only the second (most recent) round's result is saved after login — the first is discarded.
- [ ] If the score API call fails after login, an error message and Retry button appear on the login page. The user is not navigated away. The pending result is not cleared.
- [ ] Retrying after a score API failure resubmits and, on success, navigates to `/game`.
- [ ] If insights recording fails after a successful score save, the failure is silent and navigation proceeds normally.
- [ ] Refreshing the browser on `/login` while a pending result is in sessionStorage does not lose the pending result.
- [ ] An authenticated user who completes a round has their score and insights saved immediately as before — the new flow does not affect the authenticated path.
- [ ] Smart practice pre-game gate for guests is unchanged.
- [ ] Pause and quit behaviour during active gameplay is unchanged.
- [ ] After login or registration with a pending result, `luna_pending_result` is absent from sessionStorage.
- [ ] The same pending result cannot be submitted twice (guard against double-submit).

---

## Open Questions

- None at this stage.

---

## Assumptions

- `isEarlyQuit` should be stored in the pending result payload for fidelity, even though it does not change how the score is submitted (server recomputes regardless).
- Insights recording on a guest-converted round is desirable (same as authenticated flow) rather than score-only saving.
- The post-save destination is `/game` (unchanged from current login/register behaviour). A "Score saved!" confirmation banner on `/game` is a desirable enhancement but is out of scope for this spec.
- The feature is client-side only. No server changes are required.

---

## File Impact

### Files Confirmed To Exist

- `client/src/components/MultiplicationGame/MultiplicationGame.jsx`
- `client/src/Pages/Login/Login.jsx`
- `client/src/Pages/Register/Register.jsx`
- `client/src/context/AuthContext.jsx`
- `client/src/hooks/useSubmitScore.js`
- `client/src/hooks/useRecordInsights.js`
- `client/src/Pages/Game/Game.jsx`

### Files To Create

None.

### Files To Update

| File | Change summary |
|---|---|
| `client/src/components/MultiplicationGame/MultiplicationGame.jsx` | (1) Extend `finishGame` to accept an `earlyQuit` boolean parameter. (2) When `!user`, write `luna_pending_result` to `sessionStorage` at the end of `finishGame`. (3) In `handleStartGame`, remove `luna_pending_result` from `sessionStorage` before the round begins. (4) Update guest game-over CTA copy to reference `lastGameSummary.score`. |
| `client/src/Pages/Login/Login.jsx` | After `login(data.token, data.user)`, read and parse `luna_pending_result` from `sessionStorage`. If present: submit score via direct `fetch` using `data.token`; on success fire-and-forget insights and clear sessionStorage; on failure show error + Retry and block navigation. |
| `client/src/Pages/Register/Register.jsx` | Same additions as Login.jsx. |
