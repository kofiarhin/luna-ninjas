# Insights Quick Launch — Clickable Table Summary Cards

## Summary

Table summary cards on the Insights page are currently passive stat displays. This feature makes them interactive: clicking a card like ×4 or ÷5 navigates directly to `/game` and starts that exact round immediately, skipping all three selection steps (operation → mode → table). The feature uses router location state to pass the target and is consumed once on mount by `Game.jsx`.

## Goal

A user on the Insights page can tap any table summary card and land directly in a running game for that table and operation, with zero extra steps.

## Non-Goals

- Redesigning the Insights page layout or the heatmap.
- Adding a new route or URL for pre-selected games.
- Supporting quick-launch from the heatmap cells (only summary cards).
- Changing how manually-initiated games work in any way.
- Adding a new practice mode for this flow (uses existing "smart" mode).

## Problem

After reviewing their Insights data, a user who wants to practice a specific weak table must navigate to `/game`, re-pick the operation, pick a mode, then pick the table. Three steps they already answered by reading the Insights page. The summary cards should be the shortcut.

## Users / Actors

Authenticated users on the `/insights` page who have data for at least one operation (so the table summary section is visible).

---

## Core Requirements

1. All 11 table summary cards (×2–×12, ÷2–÷12) are clickable regardless of their mastery state (mastered, learning, struggling, unseen).
2. Clicking a card navigates to `/game` via React Router and passes `{ operation, table }` as router location state.
3. `Game.jsx` reads `location.state` on mount. If valid `operation` and `table` are present, it initialises all three state values (`selectedOperation`, `selectedMode = 'smart'`, `selectedTable`) immediately, bypassing all selection screens.
4. The mode for all quick-launched rounds is `"smart"`. This is fixed — the user is coming from performance data and smart practice is the most relevant choice.
5. Location state is consumed once. After Game reads it, it is cleared from history so a browser refresh or back/forward navigation does not re-trigger the quick-launch.
6. A small contextual label ("Practising ×4" / "Practising ÷5") is shown on the pre-game ready screen when the round was quick-launched. It replaces or sits alongside the existing table display.
7. When Play Again is clicked after a quick-launched round, the same operation/table/smart round is repeated. The user is not returned to the selection flow.
8. The normal manual flow (arriving at `/game` with no location state) is completely unchanged.
9. Invalid or missing location state silently falls through to the normal operation selector.

---

## User Flows

### Quick-launch flow
1. User is on `/insights`, viewing multiplication table summaries.
2. User clicks the ×4 card.
3. `Insights.jsx` calls `navigate('/game', { state: { operation: 'multiplication', table: 4 } })`.
4. `Game.jsx` mounts, reads `location.state`, finds valid `{ operation: 'multiplication', table: 4 }`.
5. Sets `selectedOperation = 'multiplication'`, `selectedMode = 'smart'`, `selectedTable = 4`. Stores `practiceTarget = { operation: 'multiplication', table: 4 }`.
6. Clears location state from history.
7. `MultiplicationGame` renders immediately (no selection screens shown).
8. Pre-game ready screen shows "Practising ×4" and "Smart Practice mode".
9. User starts and completes the round.
10. Play Again button calls `onPlayAgain`. `Game.jsx` detects `practiceTarget` is set and re-initialises the same three state values (does not reset to `null`).

### Normal flow (unaffected)
1. User navigates to `/game` via nav link or direct URL.
2. No `location.state` — `Game.jsx` initialises all state to `null` as today.
3. Operation → mode → table selection proceeds as normal.

### Refresh / direct URL after quick-launch
1. Location state is gone (cleared after first consume or lost on refresh).
2. `Game.jsx` finds no valid state, falls through to normal operation selector.

---

## Functional Details

### Insights.jsx — UI changes

- Import `useNavigate` from `react-router-dom`.
- Each `<div>` card in the `ins__cards` section becomes a `<button>` (or retains `<div>` with `role="button"`, `tabIndex={0}`, and keyboard handler — `<button>` is preferred for accessibility).
- `onClick` handler calls `navigate('/game', { state: { operation: activeOp, table: s.table } })`.
- Cards get a new CSS modifier class `ins__card--interactive` (or just cursor pointer + hover styles on the existing card classes) to signal clickability. Do not add a separate CTA label inside the card — the visual affordance is sufficient.
- No change to the card content (symbol, accuracy %, correct/attempts).
- Cards are clickable regardless of mastery category including "unseen".
- The operation toggle selection (`activeOp`) determines whether the card is multiplication or division — no extra logic needed, it is already the source of `opSymbol`.

### Game.jsx — state initialisation

Current state shape:
```
selectedOperation  null | "multiplication" | "division"
selectedMode       null | "standard" | "smart"
selectedTable      null | 2..12
```

New state to add:
```
practiceTarget     null | { operation, table }
```

On mount (inside a `useEffect` with `[]` dependency):
- Read `location.state` via `useLocation()`.
- If `location.state?.operation` is one of `["multiplication", "division"]` AND `location.state?.table` is an integer between 2 and 12:
  - Set `selectedOperation`, `selectedMode = 'smart'`, `selectedTable`.
  - Set `practiceTarget = { operation, table }`.
  - Clear location state: `navigate(location.pathname, { replace: true, state: null })`.
- Otherwise: no-op, all state remains `null`.

`handlePlayAgain` change:
- If `practiceTarget` is not null: re-set `selectedOperation`, `selectedMode = 'smart'`, `selectedTable` from `practiceTarget`. Do NOT reset them to `null`.
- If `practiceTarget` is null (normal flow): reset all to `null` as today.

No other logic changes in `Game.jsx`.

### MultiplicationGame.jsx — label display

The pre-game ready screen (the `isInitialState` block) currently shows:
- `{opSymbol}{table}` as the table display
- "Smart Practice mode" when `isSmart`

For quick-launched rounds, a "Practising" label is shown. Two options for implementation:

**Option A (recommended):** Pass a boolean `isQuickLaunch` prop from `Game.jsx` (true when `practiceTarget` is set). `MultiplicationGame` renders "Practising ×4" as supplementary text below the table display in the ready screen.

**Option B:** No prop change — rely on the existing "Smart Practice mode" label already present. This is minimal but loses the explicit "you came from Insights" context.

Recommendation: Option A. Adds one prop and one conditional text line. Keeps `MultiplicationGame` unaware of routing but informed of launch context.

### Routing

No new routes. No query params. `/game` route in `App.jsx` is unchanged.

Navigation uses `useNavigate` (already imported in other pages in this repo). `useLocation` is added to `Game.jsx`.

---

## States and Edge Cases

| Scenario | Behaviour |
|---|---|
| Card with "unseen" state clicked | Navigates normally. Smart Practice will have low/no data — `lowData: true` flag from API is already handled in `MultiplicationGame` (shows a warning). |
| Card with "mastered" state clicked | Navigates normally. No special messaging — user chose to practice it. |
| User refreshes `/game` after quick-launch | Location state is gone. Normal operation selector shown. |
| User navigates to `/game` from nav header | No location state. Normal flow unchanged. |
| Invalid location state (wrong operation string, table out of range) | Silently falls through to normal operation selector. |
| User hits back button from game to Insights | React Router pops history. Location state is already cleared — no re-trigger. |
| No facts for the selected operation (empty state shown) | Summary cards are not rendered (existing behaviour). Feature not reachable in this state. No change needed. |
| User is not authenticated | `/insights` is already auth-gated. `/game` is not auth-gated but submitting scores requires auth. Score submission behaviour is unchanged. |

---

## Technical Notes

- **State transport**: React Router `location.state` is the right choice for this repo. It requires no new context, no localStorage, no query param parsing. It is in-memory, lost on refresh, and zero-cost to validate. The existing pattern in other plan docs (multi-operation spec, smart practice spec) establishes that this codebase routes with React Router DOM.
- **Why not query params**: Query params survive refresh and require parsing/validation. They would also expose the selection in the URL unnecessarily. Router state is cleaner for ephemeral navigation intent.
- **Why not context**: Adding a `PracticeTargetContext` for a one-way, one-shot navigation handoff is over-engineered. Router state achieves the same result without a new provider.
- **Why smart mode**: A user arriving from Insights is acting on performance data. Smart Practice is the mode designed for weakness-aware targeting. Defaulting to standard would ignore why the user is there. The mode is not surfaced as a user choice in this flow — it is an implementation decision.
- **Location state clearing**: Clear with `navigate(location.pathname, { replace: true, state: null })` inside the `useEffect`. This prevents the state from re-applying if the component re-mounts or the user navigates away and returns via history.
- **`useEffect` dependency**: The init effect runs once on mount with `[]`. `location` object from `useLocation` is stable across renders for the mount snapshot. Do not include `location` in the dep array or it will re-fire on every navigation.
- **`/game` not auth-gated**: This is existing behaviour. Quick-launch from Insights (which IS auth-gated) is safe — a user who can reach Insights is authenticated. No change needed.

---

## Acceptance Criteria

- [ ] Clicking a multiplication table summary card (e.g. ×7) on Insights navigates to `/game` and starts a smart practice round for table 7, multiplication, with no selection screens shown.
- [ ] Clicking a division table summary card (e.g. ÷5) on Insights navigates to `/game` and starts a smart practice round for table 5, division.
- [ ] Cards in all four states (mastered, learning, needs work, unseen) are clickable and behave identically.
- [ ] The pre-game ready screen for a quick-launched round shows a "Practising ×N" or "Practising ÷N" label.
- [ ] The pre-game ready screen shows "Smart Practice mode" (existing label, now always shown for quick-launched rounds).
- [ ] Refreshing `/game` after a quick-launch shows the normal operation selector, not a resumed quick-launch.
- [ ] Play Again after a quick-launched round repeats the same table/operation/smart round.
- [ ] Navigating to `/game` via the header nav link shows the normal operation selector, unaffected.
- [ ] Manual game flow (operation → mode → table) is fully functional and unchanged.
- [ ] Invalid location state (wrong operation, table out of range, missing fields) falls through silently to normal flow.

---

## Test Coverage

### Unit tests (client/src/utils/ or component-level)

- None required at the utility level — no new utility functions are added.

### Integration / route tests (new test file or additions to existing game tests)

**`client/src/Pages/Game/Game.test.jsx`** (create if not exists):

1. When rendered with no location state, shows `OperationSelector`.
2. When rendered with valid `{ operation: 'multiplication', table: 4 }` in location state, shows `MultiplicationGame` directly (skips selectors).
3. When rendered with valid division state `{ operation: 'division', table: 6 }`, shows `MultiplicationGame`.
4. When rendered with invalid operation (e.g. `{ operation: 'addition', table: 4 }`), falls through to `OperationSelector`.
5. When rendered with out-of-range table (e.g. `{ operation: 'multiplication', table: 1 }`), falls through to `OperationSelector`.
6. After quick-launch, clicking Play Again re-shows `MultiplicationGame` (not the selectors).
7. After normal play, clicking Play Again shows `OperationSelector`.

**`client/src/Pages/Insights/Insights.test.jsx`** (create if not exists, or add to existing):

8. Clicking a multiplication table summary card calls `navigate('/game', { state: { operation: 'multiplication', table: N } })`.
9. Clicking a division table summary card calls `navigate('/game', { state: { operation: 'division', table: N } })`.
10. Cards are rendered as focusable, clickable elements (button role present).

---

## Open Questions

- Should Play Again after a quick-launched round offer a "back to table selection" option in addition to repeating? Current spec says repeat-only for simplicity. Revisit if user testing shows friction.

---

## Assumptions

- All quick-launched rounds use "smart" mode. If product decides users should choose standard vs smart for quick-launches, an additional PracticeModeSelector step or a UI affordance on the card would be needed.
- The `/game` route remaining non-auth-gated is intentional (existing behaviour). No change required.
- The `ins__card` elements being `<div>` today is intentional styling — switching to `<button>` requires CSS normalisation (remove default button border/background) but no structural redesign.

---

## File Impact

### Files Confirmed To Exist

- `client/src/Pages/Insights/Insights.jsx`
- `client/src/Pages/Game/Game.jsx`
- `client/src/components/MultiplicationGame/MultiplicationGame.jsx`
- `client/src/App.jsx`

### Files To Create

- `client/src/Pages/Game/Game.test.jsx`
- `client/src/Pages/Insights/Insights.test.jsx` (or extend if already exists)

### Files To Update

| File | Change |
|---|---|
| `client/src/Pages/Insights/Insights.jsx` | Import `useNavigate`. Convert `ins__card` divs to buttons. Add `onClick` handler. Add hover/interactive CSS class. |
| `client/src/Pages/Game/Game.jsx` | Import `useLocation`, `useNavigate`. Add `practiceTarget` state. Add mount `useEffect` to consume location state. Update `handlePlayAgain` to repeat vs reset based on `practiceTarget`. Pass `isQuickLaunch` prop to `MultiplicationGame`. |
| `client/src/components/MultiplicationGame/MultiplicationGame.jsx` | Accept `isQuickLaunch` prop. Render "Practising ×N / ÷N" label in `isInitialState` block when `isQuickLaunch` is true. |
| `client/src/Pages/Insights/insights.styles.scss` | Add cursor pointer and hover affordance styles for clickable cards (`ins__card--interactive` or direct on `ins__card`). |
