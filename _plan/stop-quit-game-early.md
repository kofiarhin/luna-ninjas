# Stop / Quit Game Early

## Summary

Add a Quit button that lets a player deliberately end an active round before all 12 questions are answered. Unlike Pause, which keeps the round alive and resumes it, Quit terminates the round permanently. The in-progress question is discarded. Any questions answered before quitting are preserved — scored, submitted (for authenticated users), and shown in the standard `GameSummary` screen with a "Quit" completion marker. The player then follows the normal Play Again flow.

---

## Goal

A player who wants to stop mid-round can do so cleanly without losing the progress they made, without the round hanging indefinitely, and without needing to kill the browser tab or navigate away.

---

## Non-Goals

- No new route or page.
- No changes to the backend score or insights APIs.
- No redesign of the game layout beyond the Quit control and confirm step.
- No changes to Pause behavior.
- No "undo quit" or ability to resume after quitting.
- No quit limit per session.
- No changes to the pre-game ready screen or standard game-over screen.

---

## Problem

There is currently no way for a player to intentionally end a round early. If interrupted or simply done, their only options are to let the timer drain lives until game over, or navigate away entirely (losing all partial progress). Quit gives a clean, deliberate exit that respects the player's completed work.

---

## Users / Actors

- Any player (guest or authenticated) in an active game round — standard or smart practice.

---

## Core Requirements

1. A Quit button is visible only during active gameplay (`gameActive === true`), including while paused.
2. Pressing Quit opens a confirm overlay ("Are you sure you want to quit?") — it does **not** immediately end the round.
3. The confirm overlay disables all answer buttons and freezes the timer (the round is effectively paused while the overlay is open, whether or not `isPaused` was already true).
4. If the player confirms quit:
   - The in-progress question is discarded (not logged, not scored, not sent to insights).
   - `gameActive` is set to `false`.
   - `gameOver` is set to `true`.
   - `GameSummary` is shown using the questions answered so far.
   - If the player is authenticated, partial score and partial insights are submitted exactly as a normal `finishGame` would do.
5. If the player cancels quit:
   - The confirm overlay closes.
   - If the game was active (not paused) before Quit was pressed, the timer resumes from where it was.
   - If the game was paused before Quit was pressed, it returns to the paused state.
6. The quit flow must not affect lives, score, or streak from questions answered before Quit was pressed.
7. Quit is available in both standard and smart practice modes with identical behavior.
8. The in-progress question — the one visible when Quit is triggered — must not be answerable after Quit is pressed, including during the confirm step.

---

## User Flows

### Flow 1: Player quits mid-round, confirms

1. Player is on question 5 of 12, timer at 4 seconds, score 30.
2. Player presses Quit.
3. Timer freezes. Answer buttons become inert. Confirm overlay appears: "Quit this game?" with Confirm and Cancel buttons.
4. Player presses Confirm.
5. Question 5 is discarded — not logged, not scored, not penalised.
6. Round ends. `GameSummary` is shown with score = 30, totalQuestions = 4 (questions answered before Q5), accuracy based on those 4.
7. `GameSummary` title shows "Round Ended Early" instead of "Game Over".
8. If authenticated: partial score and insights are submitted.
9. Play Again button works normally.

### Flow 2: Player quits mid-round, cancels

1. Player is on question 5, timer at 4 seconds.
2. Player presses Quit.
3. Timer freezes. Confirm overlay appears.
4. Player presses Cancel.
5. Overlay closes. Timer resumes from where it froze (4 seconds). Question 5 is still live.
6. Round continues normally.

### Flow 3: Player quits while paused

1. Player paused on question 7 (question 7 already discarded by pause behavior).
2. From the pause overlay, player presses Quit.
3. Confirm overlay appears over the pause overlay.
4. Player confirms.
5. Round ends. `GameSummary` shows progress from questions 1–6 (the 6 logged before the pause).
6. Submission and summary behavior identical to Flow 1.

### Flow 4: Player quits on the first question

1. Player has answered 0 questions. They press Quit and confirm.
2. `questionLog` is empty. `correctCount = 0`, `totalQuestions = 0`, `score = 0`.
3. `GameSummary` shows zeros. If authenticated, `submitScore(0)` is called (score of 0 is submitted normally — server increments `totalScore` by 0, which is a no-op in practice).
4. Insights `record([])` is called with an empty array — no-op on the server.

### Flow 5: Player quits after `hasAnswered` is true (post-answer delay window)

1. Player answered question 6 correctly. `hasAnswered` is `true`. A 700ms delay is pending before question 7 loads.
2. During this window, the Quit button is visible and pressable (it is not gated by `hasAnswered`).
3. Player presses Quit. Confirm overlay appears.
4. If confirmed: the pending `setTimeout` fires after the overlay appears — the `proceedAfterQuestion` call inside the timeout must be guarded against running if quit has been confirmed. See Technical Notes.
5. The question log already contains question 6 (it was logged before the delay). That is correct — it was fully answered.

---

## Functional Details

### Pause vs. Quit — Cleanest Distinction

| Dimension | Pause | Quit |
|---|---|---|
| Round state after action | Alive — resumes | Terminated — game over |
| In-progress question | Discarded on resume | Discarded immediately |
| Score/lives/streak | Unchanged | Preserved up to last answered question |
| Submission | Deferred until round ends normally | Triggered immediately on confirm |
| Available during | Active gameplay only (`!hasAnswered`) | Active gameplay + while paused |
| Reversible? | Yes (Resume) | No |
| UI trigger | Pause button in header | Quit button in header (and pause overlay) |

### Quit Control Placement

**Recommended: `GameHeader` + pause overlay (both)**

- `GameHeader` renders the Quit button in `gh__controls`, alongside the Pause button and timer, visible whenever `gameActive === true`.
- The existing pause overlay (`mg__paused`) adds a Quit button below the Resume button — so a paused player doesn't need to resume first to quit.
- This means Quit appears in two places but is always accessible without disrupting other controls.

**Why available while paused:** The player is already in an interrupted state. Forcing them to resume just to quit is friction with no benefit.

**Quit button must not be gated by `hasAnswered`.** The post-answer feedback delay is 700–900ms — too brief to matter for quit UX, and there is no cheat risk in quitting after a correct answer (the question was already logged).

### Confirm Step

A confirm overlay is required. Quit is irreversible and discards partial progress if triggered accidentally (especially on a touchscreen). The confirm step must:

- Replace or layer over the current game content (including the pause overlay if active).
- Show: "Quit this game?" heading, a brief subline ("Your progress so far will be saved."), Confirm button, Cancel button.
- Block all game interaction while open (timer frozen, answers not pressable).
- Be keyboard navigable: focus moves to Confirm button on open; Escape cancels; Tab cycles between Confirm and Cancel.
- Confirm button has `aria-label="Confirm quit"`, Cancel has `aria-label="Cancel quit"`.

**Timer behavior during confirm:** Freeze the timer by setting a `isConfirmingQuit` flag that the timer `useEffect` treats as a pause condition. The timer value (`timeLeft`) must not change while the confirm overlay is open.

**Cancelling with the game active (not paused):** The `isConfirmingQuit` flag is cleared. The timer resumes from the frozen `timeLeft` value — it was never decremented while the overlay was open.

**Cancelling while paused:** The `isConfirmingQuit` flag is cleared. `isPaused` is still `true`. The pause overlay returns.

### State Changes in `MultiplicationGame.jsx`

Add one new state variable:

```
const [isConfirmingQuit, setIsConfirmingQuit] = useState(false);
```

**Timer effect guard — add `isConfirmingQuit`:**

```
if (!gameActive) return;
if (hasAnswered) return;
if (isPaused) return;
if (isConfirmingQuit) return;   // ← add
```

**`handleAnswer` guard — add `isConfirmingQuit`:**

```
if (!gameActive || hasAnswered || timeLeft <= 0 || isPaused || isConfirmingQuit) return;
```

**`handleTimeout` guard — add `isConfirmingQuit`:**

```
if (!gameActive || hasAnswered || isPaused || isConfirmingQuit) return;
```

**`handleQuit` — new handler:**

- Set `isConfirmingQuit = true`.

**`handleCancelQuit` — new handler:**

- Set `isConfirmingQuit = false`.
- (`isPaused` state is unchanged — returns to whichever state the game was in before.)

**`handleConfirmQuit` — new handler:**

- Set `isConfirmingQuit = false`.
- Call `finishGame(questionIndex, lives, score, questionLog)` — pass the current `questionLog` as-is (the in-progress question was never logged).
- `finishGame` sets `gameActive = false`, `gameOver = true`, computes summary, and triggers submission and insights recording for authenticated users.
- No new code path needed — `finishGame` is fully reused.

**`handleStartGame`** — reset `isConfirmingQuit = false` alongside existing resets.

**`proceedAfterQuestion` setTimeout guard (post-answer delay):**

If the player quits during the 700–900ms post-answer delay, the pending `setTimeout` will still fire and call `proceedAfterQuestion`. At that point `gameActive` is already `false` (set by `finishGame`), so the existing `showQuestion` call inside `proceedAfterQuestion` will receive a stale `questions` array but the `gameActive` check at the top of the effect loop will prevent the timer from starting. However, `proceedAfterQuestion` itself doesn't guard on `gameActive` — it calls `finishGame` or `showQuestion` unconditionally.

To prevent double-`finishGame`, add a guard: check `gameOver` (or `!gameActive`) before calling `proceedAfterQuestion` inside the `setTimeout` callbacks in `handleAnswer` and `handleTimeout`. The cleanest approach is a `useRef` cancel flag set in `handleConfirmQuit` and checked inside the `setTimeout` callbacks. See Technical Notes for detail.

### `GameSummary` — "Round Ended Early" Presentation

`GameSummary` currently renders a hardcoded "Game Over" heading. To distinguish a quit from a natural game end:

- Pass an optional `earlyQuit` boolean prop to `GameSummary`.
- When `earlyQuit === true`, render "Round Ended Early" as the heading instead of "Game Over".
- All other fields (score, accuracy, lives remaining, answered count) are unchanged — they already work correctly with a partial log.

The `lastGameSummary` object does not need a new field. The `earlyQuit` prop is passed directly from `gameOver` render site in `MultiplicationGame.jsx` using a new `isEarlyQuit` state variable set in `handleConfirmQuit`.

```
const [isEarlyQuit, setIsEarlyQuit] = useState(false);
```

Set `isEarlyQuit = true` in `handleConfirmQuit`. Reset to `false` in `handleStartGame`.

### Score and Insights Submission on Quit

- **Authenticated users:** `finishGame` is called with the partial `questionLog`. It calls `submitScore(correctCount)` and `record(updatedLog)` — exactly as a normal round end. No backend changes needed.
- **Guest users:** submission is skipped (the existing `if (user)` guard in `finishGame` handles this).
- **Score submitted is the partial score.** There is no "quit penalty" — the player is not punished for stopping early.
- **The in-progress question is not included** in `correctCount` or the insights record because it was never appended to `questionLog`.
- **Standard vs. smart practice:** identical behavior. Both use the same `finishGame` path.

### SCSS

Add `.mg__confirm-quit` overlay styles — full-card overlay with dark background, centred content, consistent with the existing `.mg__paused` pattern. Uses `$surface-raised` background, `$accent` Confirm button, ghost Cancel button.

---

## States and Edge Cases

| Scenario | Expected behavior |
|---|---|
| Player quits on question 1 before answering anything | `questionLog` is empty. Summary shows zeros. Submission is a no-op. |
| Player quits on question 12 (last question, unanswered) | `questionLog` has 11 entries. Summary shows 11 answered. |
| Player quits on question 12 (last question, already answered before quit) | This is the post-answer delay case. If `isConfirmingQuit` is set and then confirmed before the delay fires, the cancel-flag ref prevents `proceedAfterQuestion` from running. `finishGame` was already called by `handleConfirmQuit` with the 12-entry log — summary shows 12 answered. |
| Player presses Quit, then Cancel, then answers correctly | Timer resumes from frozen value; answer registers normally. |
| Player presses Quit during post-answer delay (correct answer already logged) | Confirm overlay appears; the logged question is preserved in `questionLog`; if confirmed, that question is in the final summary. |
| Player presses Quit while paused | Confirm overlay layers over pause overlay; Cancel returns to paused state. |
| Timer hits 0 and `handleTimeout` fires at the same moment Quit is pressed | `isConfirmingQuit` guard in `handleTimeout` prevents double-processing. If `isConfirmingQuit` is set first, timeout is blocked. |
| Guest player quits | Confirm overlay and summary work; submission is skipped by existing `if (user)` guard. |
| Smart Practice player quits with partial insights | `record(questionLog)` sends whatever was logged. Server upserts partial fact mastery normally. |
| Player confirms quit with 0 lives and 0 score | Valid — summary shows zeros, submission proceeds. |
| `handleStartGame` called after quit (Play Again) | `isConfirmingQuit = false`, `isEarlyQuit = false`, all other state reset as normal. |

---

## Technical Notes

### Cancel-flag ref for post-answer setTimeout

The `handleAnswer` and `handleTimeout` functions fire `proceedAfterQuestion` inside a `setTimeout`. If the player quits and confirms during the delay, `finishGame` is called immediately. When the timeout fires, it will call `proceedAfterQuestion` again, which calls `finishGame` or `showQuestion` a second time.

The cleanest fix is a `useRef` cancel flag:

```
const proceedCancelledRef = useRef(false);
```

- In `handleConfirmQuit`: set `proceedCancelledRef.current = true`.
- In `handleStartGame`: reset `proceedCancelledRef.current = false`.
- Inside each `setTimeout` callback before calling `proceedAfterQuestion`: check `if (proceedCancelledRef.current) return;`.

This is a minimal, targeted fix. No restructuring of the timer or game loop is needed.

### `isConfirmingQuit` as a timer freeze

The `useEffect` timer runs on `[timeLeft, gameActive, hasAnswered, isPaused]`. Adding `isConfirmingQuit` as a dependency and early-return guard is the same pattern already established for `isPaused`. `timeLeft` is preserved exactly — when Cancel is pressed, the timer resumes from the same value.

### Reuse of `finishGame`

`finishGame` already accepts `(nextQuestionIndex, nextLives, nextScore, updatedLog)` and handles the full teardown: sets `gameActive = false`, `gameOver = true`, computes summary, and triggers submission. `handleConfirmQuit` passes the current live values. No new teardown path is required.

### `GameSummary` title

The `earlyQuit` boolean prop keeps the change minimal. `GameSummary` remains a pure presentational component — it just swaps the heading string. The summary data shape is unchanged.

### No backend changes

Score submission via `POST /api/scores` accepts `correctCount` and recomputes server-side. A partial `correctCount` is valid input — the server applies the same WEIGHT_MAP regardless. Insights recording via `POST /api/insights/record` upserts whatever facts are passed — a partial array is a valid input. No contract changes.

---

## Acceptance Criteria

- [ ] A Quit button is visible during active gameplay (`gameActive === true`), including while paused.
- [ ] The Quit button is not visible on the pre-game ready screen or game-over summary screen.
- [ ] Pressing Quit opens a confirm overlay without immediately ending the game.
- [ ] The timer is frozen while the confirm overlay is open.
- [ ] Answer buttons are not pressable while the confirm overlay is open.
- [ ] Pressing Cancel closes the confirm overlay and resumes the game from where it was (timer resumes, or returns to paused state if the game was paused).
- [ ] Pressing Confirm calls `finishGame` with the current `questionLog` (excluding the in-progress question).
- [ ] After confirming quit, `gameActive` is `false` and `gameOver` is `true`.
- [ ] `GameSummary` is shown after quit — not a redirect to game setup.
- [ ] `GameSummary` heading is "Round Ended Early" (not "Game Over") after a quit.
- [ ] `GameSummary` score, accuracy, lives remaining, and answered count reflect only questions answered before quit.
- [ ] The in-progress question at quit time is not in `questionLog` and is not sent to `record()`.
- [ ] Lives, score, and streak are unchanged from the state just before Quit was pressed.
- [ ] Authenticated users have partial score submitted via `submitScore` and partial insights sent via `record` on quit.
- [ ] Guest users do not trigger any submission on quit (existing `if (user)` guard).
- [ ] Quit works identically in standard and smart practice modes.
- [ ] Quitting while paused works: confirm overlay appears, confirms ends round, cancel returns to pause overlay.
- [ ] A pending post-answer `setTimeout` that fires after quit-confirm does not call `proceedAfterQuestion` or `finishGame` a second time.
- [ ] `isConfirmingQuit` and `isEarlyQuit` reset to `false` when a new game starts via `handleStartGame`.
- [ ] The confirm overlay is keyboard accessible: focus moves to Confirm on open; Escape cancels; Tab cycles between Confirm and Cancel.
- [ ] Confirm button has `aria-label="Confirm quit"`, Cancel button has `aria-label="Cancel quit"`.
- [ ] Quit button has an accessible label (visible text or `aria-label`).

---

## Open Questions

- Should the confirm overlay show how many questions the player has answered so far? ("You've answered 4 of 12 questions — your progress will be saved.") This is a nice-to-have, not required.
- Should the Quit button be hidden during the post-answer feedback delay (`hasAnswered === true`)? It is usable and safe during that window, but hiding it keeps the control surface consistent with Pause. Decide at implementation.

---

## Assumptions

- `finishGame` is reused without modification for the quit path — the partial log is a valid input.
- The confirm overlay is a conditional render within `MultiplicationGame.jsx`, not a separate component file, since it is small and has no reuse outside this component.
- "Your progress so far will be saved" subline on the confirm overlay appears for all players (guest and authenticated). For guests this is slightly inaccurate, but adjusting the copy per auth state adds complexity for marginal benefit. Acceptable to simplify.
- Score of 0 (quit before answering anything) is submitted normally — `POST /api/scores` with `correctCount: 0` increments `totalScore` by 0. No special zero-score guard is needed.

---

## File Impact

### Files Confirmed To Exist

- `client/src/components/MultiplicationGame/MultiplicationGame.jsx`
- `client/src/components/MultiplicationGame/multiplication-game.styles.scss`
- `client/src/components/GameHeader/GameHeader.jsx`
- `client/src/components/GameSummary/GameSummary.jsx`
- `client/src/components/AnswerOptions/AnswerOptions.jsx`
- `client/package.json`

### Files To Create

- None. The confirm overlay is small enough to render inline in `MultiplicationGame.jsx`. No new component files required.

### Files To Update

| File | Changes |
|---|---|
| `MultiplicationGame.jsx` | Add `isConfirmingQuit` and `isEarlyQuit` state. Add `proceedCancelledRef`. Add `handleQuit`, `handleCancelQuit`, `handleConfirmQuit` handlers. Guard timer effect, `handleAnswer`, `handleTimeout` with `isConfirmingQuit`. Add cancel-flag ref check inside `setTimeout` callbacks. Pass `onQuit` prop to `GameHeader`. Render confirm overlay when `isConfirmingQuit`. Pass `earlyQuit` to `GameSummary`. Reset new state in `handleStartGame`. |
| `GameHeader.jsx` | Accept `onQuit` prop. Render Quit button when `gameActive` (alongside or near the Pause button). |
| `GameSummary.jsx` | Accept optional `earlyQuit` boolean prop. Render "Round Ended Early" heading when `earlyQuit === true`, "Game Over" otherwise. |
| `multiplication-game.styles.scss` | Add `.mg__confirm-quit` overlay styles. Consistent with `.mg__paused` dark pattern. Add `.gh__quit-btn` styles if button lives in header. |

### Frontend Testing

`client/package.json` has no test tooling — no Vitest, no React Testing Library, no Jest at the client level. The root `npm test` covers `server/tests/` only.

**Frontend automated tests are deferred.** Do not create partial client test files.

If frontend testing is added in future, priority cases for this feature:
- `handleQuit` sets `isConfirmingQuit = true` and freezes the timer.
- `handleCancelQuit` restores game state (timer resumes, `isPaused` unchanged).
- `handleConfirmQuit` calls `finishGame` with the pre-quit `questionLog`.
- In-progress question absent from `questionLog` after confirm.
- `proceedCancelledRef` prevents double `finishGame` in post-answer delay scenario.

This feature does not change any server contracts. No `server/tests/` files need updating.
