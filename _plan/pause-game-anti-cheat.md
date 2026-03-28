# Pause Game — Anti-Cheat Skip Behavior

## Summary

Add a Pause button to active gameplay that freezes the timer and locks interaction, but prevents score cheating by silently discarding the in-progress question. On resume, the player gets a fresh question — they can never pause, think, and then answer the same question they paused on. Pause is neutral: no life penalty, no streak reset, no insights record for the discarded question.

---

## Goal

Players can pause during a game for legitimate interruptions (phone call, distraction). Pausing cannot be used to gain a scoring advantage. The in-progress question is permanently invalidated on pause.

---

## Non-Goals

- No pause during the pre-game ready screen or post-game summary.
- No pause countdown or time limit.
- No backend changes — this is entirely client-side state.
- No redesign of the game UI layout beyond the pause overlay and button placement.
- No new routes.
- No changes to how scores are calculated or submitted.
- No replay or undo of paused questions.

---

## Problem

Without pause, players who are interrupted must either answer blindly or let the timer run out and lose a life. With pause but no anti-cheat, a player could pause, look up or reason through the current question indefinitely, then resume and answer correctly — effectively removing the time pressure that drives scoring fairness.

---

## Users / Actors

- Any player (guest or authenticated) in an active game round (standard or smart practice).

---

## Core Requirements

1. A Pause button appears only during active gameplay (`gameActive === true`).
2. Pressing Pause:
   - Sets `isPaused = true`.
   - Stops the countdown timer immediately.
   - Disables all answer option buttons.
   - Hides the question text and answer options (replaces with a paused overlay).
   - Discards the current in-progress question — it will not be answered, scored, or logged.
3. A Resume button appears on the pause overlay.
4. Pressing Resume:
   - Sets `isPaused = false`.
   - Does NOT restore the old question.
   - Advances to the next question (`questionIndex + 1`) with a full fresh 8-second timer.
   - If advancing would exceed `QUESTIONS_PER_GAME`, the game ends normally via `finishGame`.
5. The discarded question must not appear in `questionLog`.
6. The discarded question must not be sent to `record()` (insights).
7. Score, lives, and streak are unchanged by a pause.
8. Pausing is allowed multiple times per round with no guardrails.
9. Pause is only available during active gameplay — not on the pre-game screen or game-over screen.

---

## User Flows

### Flow 1: Player pauses mid-question, then resumes

1. Player is on question 4 of 12, timer is at 5 seconds.
2. Player presses Pause.
3. Timer stops. Answer buttons disappear. A pause overlay shows "Game Paused" and a Resume button.
4. Player waits (indefinitely).
5. Player presses Resume.
6. Question 4 is discarded — no log entry, no insight, no life lost, no streak change.
7. Question 5 loads with a fresh 8-second timer.
8. Round continues normally.

### Flow 2: Player pauses on the final question

1. Player is on question 12 of 12.
2. Player pauses. Question 12 is discarded.
3. Player resumes. `questionIndex + 1 = 12 >= QUESTIONS_PER_GAME`.
4. `finishGame` is called with the current `lives`, `score`, and `questionLog` (which contains only the 11 answered questions).

### Flow 3: Player pauses after a correct answer is already registered

This cannot happen. `hasAnswered` is set to `true` the moment an answer is selected or a timeout fires. The Pause button must be disabled (or hidden) once `hasAnswered` is `true`, and shown again when the next question loads.

- During the post-answer delay (`setTimeout` of 700–900ms before advancing), the game is effectively in a brief transition state. `hasAnswered` is `true` during this window, so the Pause button is inactive. No special handling needed.

---

## Functional Details

### Anti-Cheat Model

**Recommended: Neutral Discard**

On pause, the current question is simply thrown away. It is not counted as wrong, not counted as a timeout, and does not affect lives or streak. On resume, the player advances to the next question in the pre-generated `questions` array with a fresh timer.

**Why not "count as wrong/timeout"?**
Penalising pause (deducting a life or resetting streak) discourages legitimate use and is harsh for young players. The anti-cheat goal — preventing the player from banking the paused question — is fully met by discarding it. Penalty is unnecessary.

**Why not "resume with the same question"?**
Resuming the same question, even from a fixed timer value, still allows infinite think time. Any resume-same-question model requires additional complexity (capped pause duration, obfuscation of question during pause) to be cheat-resistant. Discard-and-advance is simpler and more robust.

**Streak / Lives on pause:**
- Lives: unchanged.
- Streak: unchanged. A discard is not a break in a streak — the player did not answer incorrectly.
- Score: unchanged.

**Question progress:**
- `questionIndex` advances by 1 on resume (the discarded question consumed that slot).
- Total questions shown in the round may therefore be fewer than 12 if the player pauses multiple times toward the end.
- The `GameSummary` `totalQuestions` field reflects only logged questions (answered + timeout + wrong), so accuracy % remains honest.

### State Changes in `MultiplicationGame.jsx`

Add one new state:

```
const [isPaused, setIsPaused] = useState(false);
```

**Timer effect** — add `isPaused` as a guard:

The existing effect already guards on `gameActive` and `hasAnswered`. Add `isPaused` so the countdown stops while paused:

```
if (!gameActive) return;
if (hasAnswered) return;
if (isPaused) return;   // ← add
```

**`handleAnswer`** — add `isPaused` guard:

```
if (!gameActive || hasAnswered || timeLeft <= 0 || isPaused) return;
```

**`handleTimeout`** — add `isPaused` guard:

```
if (!gameActive || hasAnswered || isPaused) return;
```

(With the timer stopped while paused this path is effectively unreachable, but the guard is a safe belt-and-braces.)

**`handlePause`** — new handler:

- Set `isPaused = true`.
- No other state changes.

**`handleResume`** — new handler:

- Set `isPaused = false`.
- Advance `questionIndex` by 1.
- Call `proceedAfterQuestion(questionIndex + 1, lives, score, questionLog)`.
  - This reuses the existing path cleanly: it either calls `finishGame` (if round is over) or `showQuestion` (which resets timer and loads the next question).
  - `showQuestion` also resets `hasAnswered = false`, clears feedback, and resets `timeLeft = 8`.

Note: `isPaused` is reset to `false` implicitly because `showQuestion` will have been called and the timer will begin for the new question. However, explicitly set `isPaused = false` before calling `proceedAfterQuestion` to be safe.

### Pause Button Placement

**Recommended: inside `GameHeader`**

`GameHeader` already owns the timer display and lives/score/streak stats — it is the natural container for game controls. The Pause button sits to the right of (or replacing) the timer while paused.

Pass two additional props to `GameHeader`:
- `isPaused` (boolean)
- `onPause` (function)
- `onResume` (function)

`GameHeader` renders the Pause button only when `gameActive && !hasAnswered`. When `isPaused`, it renders the Resume button (on the overlay, not in the header).

**Alternative: inside `MultiplicationGame` directly**

Simpler to implement — no prop threading. The Pause button can live in the `mg__play` section alongside `QuestionDisplay` and `AnswerOptions`. Acceptable if keeping `GameHeader` purely presentational is preferred.

The spec recommends Option 1 (inside `GameHeader`) for visual consistency, but Option 2 is also clean and acceptable.

### Pause Overlay UI

When `isPaused === true` and `gameActive === true`, replace the `mg__play` content with a pause overlay:

```
<div className="mg__paused">
  <p className="mg__paused-title">Game Paused</p>
  <button className="mg__btn mg__btn--start" onClick={handleResume}>
    Resume
  </button>
</div>
```

- The question text and answer options must not be visible while paused.
- Score, lives, streak, and progress bar in the header remain visible.
- Timer display is hidden or frozen (show "–" or hide the timer widget while paused).

### AnswerOptions Interaction

`AnswerOptions` already disables all buttons when `hasAnswered` is `true`. Since the overlay replaces the `mg__play` area while paused, the answer buttons simply don't render — no prop change needed in `AnswerOptions`.

If the overlay is implemented as a CSS layer over the play area rather than a conditional render swap, then pass `isPaused` to `AnswerOptions` and add it to the `disabled` condition.

The conditional render swap (hide `mg__play`, show `mg__paused`) is recommended as it is simpler and more clearly communicates the paused state.

### Smart Practice Interaction

No special handling needed. Smart rounds use the same `MultiplicationGame` component and the same `questions` array. Discarding a question from a smart round simply means fewer facts are recorded to insights, which is fine — the round had a legitimate interruption.

### Insights / Score Submission

- Discarded questions: excluded from `questionLog`, therefore automatically excluded from `record(updatedLog)` and from `correctCount` in `submitScore`.
- No backend changes required.
- `GameSummary` accuracy is calculated from `questionLog.length` — paused/discarded questions don't inflate the denominator.

### Play Again

`handlePlayAgain` triggers `onPlayAgain` in `Game.jsx`, which resets all selection state. `isPaused` is local state in `MultiplicationGame`, which unmounts and remounts — resets naturally.

---

## States and Edge Cases

| Scenario | Expected behavior |
|---|---|
| Player pauses on question 1 (very first question) | Discarded. Resume advances to question 2. |
| Player pauses on question 12 (last question) | Discarded. Resume calls `finishGame` with 11-question log. |
| Player answers correctly, then tries to pause during post-answer delay | `hasAnswered` is `true` — Pause button disabled/hidden. Not applicable. |
| Timer hits 0 while pause is pressed simultaneously | `isPaused` guard in `handleTimeout` prevents double processing. Pause wins if set first. |
| Player pauses 12 times in a row on 12 questions | All questions discarded. Round ends immediately on 12th resume via `finishGame` with an empty log. Score = 0. |
| Game over triggered while paused | Should not occur — `isPaused` stops timer and locks answers. Only `handleResume` can advance. |
| Guest player (unauthenticated) pauses | Works identically — pause is client-only. Score/insights submission is skipped for guests regardless. |
| Smart Practice with `lowData` flag pauses | No difference — same flow. |
| Quick-launch game (from Insights card) pauses | No difference — `isQuickLaunch` only affects pre-game display text. |

---

## Technical Notes

- The `timeLeft` countdown runs via a `useEffect` on `[timeLeft, gameActive, hasAnswered]`. Adding `isPaused` as a dependency and early-return guard is the minimal change to stop the timer cleanly. No `useRef`-based interval or external timer abstraction is needed.
- `proceedAfterQuestion` already handles both the "end game" and "next question" branches cleanly — resume can call it directly. This avoids duplicating finishGame/showQuestion logic.
- `isPaused` should be reset to `false` inside `handleStartGame` to ensure a clean state on each new game.
- The `bgFlash` animation on wrong answers won't trigger during pause (since `handleAnswer` and `handleTimeout` are both guarded). No animation cleanup needed.
- `WatermelonAnimation` is driven by `watermelonVisible` state, which is only set in `handleAnswer` and `handleTimeout`. It won't be in an unexpected state during pause.
- No `useRef` or `useCallback` are required for the pause handlers — simple state setters are sufficient.

---

## Acceptance Criteria

- [ ] A Pause button is visible during active gameplay only (not on pre-game screen, not on game-over screen).
- [ ] The Pause button is hidden/disabled once `hasAnswered` is `true` (i.e., not pressable during post-answer feedback delay).
- [ ] Pressing Pause immediately stops the timer countdown.
- [ ] Pressing Pause hides the question text and answer options.
- [ ] A pause overlay is shown with a visible "Game Paused" label and a Resume button.
- [ ] Score, lives, streak, and progress bar remain visible while paused.
- [ ] Pressing Resume loads the next question in the sequence with a fresh 8-second timer.
- [ ] The question that was in-progress at pause time is not counted as correct, wrong, or timeout.
- [ ] The discarded question does not appear in `questionLog`.
- [ ] The discarded question is not sent to `record()` for insights.
- [ ] Lives are unchanged by a pause.
- [ ] Streak is unchanged by a pause.
- [ ] Score is unchanged by a pause.
- [ ] If the paused question was the last question in the round, Resume triggers `finishGame` — the round ends correctly.
- [ ] Multiple pauses in a single round work correctly.
- [ ] Pause works identically in standard and smart practice modes.
- [ ] `isPaused` resets to `false` when a new game starts via `handleStartGame`.
- [ ] The Resume button is keyboard-accessible (focusable, activatable via Enter/Space).
- [ ] The Pause button has an accessible label (either visible text or `aria-label`).

---

## Open Questions

- Should the timer widget in the header be hidden entirely while paused, or show a frozen value (e.g., the `timeLeft` at pause time)? Both are defensible — hiding it is cleaner, freezing it provides context. Decide at implementation.
- Should a "questions remaining" count appear on the pause overlay so the player knows how many questions are left in the round? Nice-to-have; not required for anti-cheat.

---

## Assumptions

- Pausing is allowed an unlimited number of times per round. Given the target audience (children learning times tables), adding a pause limit adds complexity without meaningful benefit.
- `isPaused` is reset naturally on Play Again because `MultiplicationGame` unmounts/remounts via `Game.jsx` state reset. No explicit reset needed beyond `handleStartGame`.
- The pause overlay is a conditional render swap (hide `.mg__play`, show `.mg__paused`), not a CSS overlay — this is simpler and avoids z-index concerns.

---

## File Impact

### Files Confirmed To Exist

- `client/src/components/MultiplicationGame/MultiplicationGame.jsx`
- `client/src/components/MultiplicationGame/multiplication-game.styles.scss`
- `client/src/components/GameHeader/GameHeader.jsx`
- `client/src/components/AnswerOptions/AnswerOptions.jsx`
- `client/package.json`

### Files To Create

- None required. The pause overlay is small enough to render inline in `MultiplicationGame.jsx` with SCSS added to the existing stylesheet.

### Files To Update

| File | Changes |
|---|---|
| `MultiplicationGame.jsx` | Add `isPaused` state; add `handlePause` and `handleResume` handlers; guard timer effect, `handleAnswer`, and `handleTimeout`; render pause overlay when `isPaused`; pass `isPaused`/`onPause`/`onResume` to `GameHeader`; reset `isPaused` in `handleStartGame`. |
| `GameHeader.jsx` | Accept `isPaused`, `onPause`, `onResume` props; render Pause button when `gameActive && !hasAnswered && !isPaused`; hide/freeze timer display when paused. |
| `multiplication-game.styles.scss` | Add `.mg__paused` overlay styles (centered layout, title, consistent with existing dark theme). Add `.gh__pause-btn` styles if button lives in header. |

### Frontend Testing

`client/package.json` has no test tooling — no Vitest, no React Testing Library, no Jest integration at the client level. The root `npm test` runs Jest against `server/tests/` only.

**Frontend automated tests are deferred.** Do not create partial client test files.

If frontend testing is added in future, the following scenarios would be the priority cases to cover for this feature:
- `handlePause` stops timer (mock `setTimeout`/`setInterval`).
- `handleResume` advances `questionIndex` and calls `showQuestion`.
- Discarded question absent from `questionLog` after resume.
- `isPaused` gate in `handleAnswer` prevents answer registration.

This feature does not affect any server contracts. No existing `server/tests/` files need updating.
