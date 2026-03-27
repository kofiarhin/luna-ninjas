# Division-Aware Insights

## Summary

This spec audits the current Insights / Performance system to determine whether it fully supports division gameplay. After inspecting every file in the pipeline — from question generation through recording, storage, retrieval, and display — the finding is that **division insight support is already fully implemented**. No code changes are needed. This spec documents the current behavior, verifies correctness at each layer, and calls out one database migration concern for deployments that had the older multiplication-only index.

## Goal

Confirm that the Insights system correctly records, stores, retrieves, and displays division gameplay performance as a first-class operation alongside multiplication. If any gaps exist, define exactly how to fix them.

## Non-Goals

- No new operation types beyond multiplication and division
- No adaptive recommendations or smart suggestions
- No leaderboard redesign
- No guest score or insight persistence
- No major UI redesign
- No code generation

## Problem

The Insights feature was originally built for multiplication only. After the multi-operation math game expansion, the system needed to support division insights with correct fact identity, separate storage, and a usable UI. The question is whether the implementation completed during that expansion is correct and complete.

## Users / Actors

- **Authenticated user**: plays multiplication and division rounds; expects to see separate, accurate performance data for each operation on the Insights page
- **Guest user**: plays but has no insight data saved (unchanged)

---

## Existing Repo Findings

### Layer-by-layer audit

#### 1. Question Generation (`client/src/utils/questionGenerator.js`)

- `generateDivisionRound(table)` produces 12 questions with `a = table` (divisor), `b = quotient` (1–12 shuffled), `correctAnswer = b`
- Question text: `"What is ${table * b} ÷ ${table}?"`
- `a` and `b` represent stable fact identity: divisor and quotient
- **Verdict: Correct.** Division fact identity is `(table, quotient)`, not `(dividend, divisor)`.

#### 2. Question Log (`client/src/components/MultiplicationGame/MultiplicationGame.jsx`)

- Both `handleAnswer` and `handleTimeout` create log entries with `{ a: question.a, b: question.b, ..., operation }`
- For division rounds, `a = table` (divisor), `b = quotient` — matches the question generator
- The `operation` field is set from the component's `operation` prop
- **Verdict: Correct.** Log entries carry the right fact identity and operation tag.

#### 3. Insight Recording Hook (`client/src/hooks/useRecordInsights.js`)

- Maps each log entry to `{ a: q.a, b: q.b, isCorrect: q.isCorrect, operation: q.operation || "multiplication" }`
- Sends `POST /api/insights/record` with the full facts array
- **Verdict: Correct.** Passes through fact identity and operation faithfully.

#### 4. Backend Controller (`server/controllers/insightController.js`)

- `recordInsights`: For each fact, reads `operation` (defaults to `"multiplication"` if absent)
  - Multiplication: commutative normalization `factA = min(a, b)`, `factB = max(a, b)`
  - Division: stores as-is `factA = a` (divisor/table), `factB = b` (quotient)
  - Upsert filter includes `operation` field
- `getInsights`: Returns all facts for the user including `operation` field, sorted by `operation, factA, factB`
- **Verdict: Correct.** Division facts preserve divisor + quotient semantics. Multiplication facts remain commutatively normalized. The two are stored as separate records.

#### 5. Data Model (`server/models/factMastery.model.js`)

- Schema has `operation` field: `{ type: String, enum: ["multiplication", "division"], default: "multiplication", required: true }`
- Compound unique index: `(userId, factA, factB, operation)` — ensures multiplication and division facts for the same number pair are separate documents
- **Verdict: Correct.** The model supports operation-aware storage.

#### 6. Insight Fetch Hook (`client/src/hooks/useInsights.js`)

- Fetches all facts for the user (both operations) in a single request
- Filtering by operation is handled by the Insights page component
- **Verdict: Correct.** This is the right design — one fetch, client-side filtering.

#### 7. Insights Page (`client/src/Pages/Insights/Insights.jsx`)

- **Toggle**: Segmented control with "Multiplication" and "Division" buttons, defaults to multiplication
- **Filtering**: `filteredFacts` filters by `(f.operation || "multiplication") === activeOp` — handles legacy records without `operation` field
- **Fact Map**: Builds lookup from filtered facts using `${f.factA}-${f.factB}` as key
- **Cell Data**:
  - Multiplication: `getCellData(table, m)` uses key `${min(table, m)}-${max(table, m)}` — commutative lookup
  - Division: `getCellData(table, m)` uses key `${table}-${m}` — direct lookup (table = divisor, m = quotient)
- **Heatmap Layout**:
  - Multiplication: rows = tables (2–12), columns = multipliers (1–12), corner symbol `×`
  - Division: rows = quotients (1–12), columns = divisor tables (2–12), corner symbol `÷`
- **Tooltips**:
  - Multiplication: `"7 × 3 — Mastered (95%)"`
  - Division: `"21 ÷ 7 = 3 — Learning (75%)"` (derives dividend as `table * quotient`)
- **Table Summaries**: Computed per operation with correct key generation for each mode
- **Empty State**: `"No {operation} data yet. Play some {operation} games to see your performance breakdown here."`
- **Verdict: Correct.** Full division support with correct heatmap semantics, tooltips, and summaries.

#### 8. Styles (`client/src/Pages/Insights/insights.styles.scss`)

- Toggle button styles: `.ins__toggle` and `.ins__toggle-btn--active` with accent color
- **Verdict: Correct.** Toggle is styled consistently with the design system.

---

## Current Behavior

The system **already fully supports division insights**:

1. A user plays a division round → question log entries contain `operation: "division"` with `a = divisor`, `b = quotient`
2. On game over, `useRecordInsights` sends facts with operation to the backend
3. Backend stores division facts with `factA = divisor`, `factB = quotient`, `operation = "division"` — no commutative normalization
4. Backend stores multiplication facts with commutative normalization and `operation = "multiplication"`
5. The two never collide due to the compound unique index including `operation`
6. `GET /api/insights` returns all facts with `operation` field
7. The Insights page has a toggle between Multiplication and Division views
8. Each view correctly filters, maps, and displays facts for its operation
9. The division heatmap uses rows as quotients and columns as divisor tables
10. Table summaries are computed correctly per operation

## Problems / Gaps

**No functional gaps exist.** The division insight pipeline is complete from question generation through display.

**One deployment concern:**

If the database was created before the `operation` field was added, the old compound unique index `(userId, factA, factB)` may still exist alongside the new `(userId, factA, factB, operation)`. Mongoose does not automatically drop old indexes — it only creates new ones (when `autoIndex` is enabled). If both indexes exist:

- The old index would reject a user having both a multiplication and division record for the same `(factA, factB)` pair, because the old index doesn't include `operation`
- This would cause a duplicate key error on the second upsert

**Fix**: Drop the old index manually if it exists:
```
db.factmasteries.dropIndex("userId_1_factA_1_factB_1")
```

This only applies to databases that had the original multiplication-only schema. New databases will only have the new four-field index.

## Proposed Behavior

No changes proposed. The current implementation is correct and complete.

## Data Model Decision

Already decided and implemented correctly:

- **Multiplication fact identity**: `factA = min(a, b)`, `factB = max(a, b)`, `operation = "multiplication"` — commutative
- **Division fact identity**: `factA = divisor (table)`, `factB = quotient`, `operation = "division"` — not commutative, preserves divisor + quotient semantics
- **Compound unique index**: `(userId, factA, factB, operation)` — allows same number pair to exist as both a multiplication and division fact

## Backend Changes

None needed.

## Frontend Changes

None needed.

## Division Heatmap Rules

Already implemented:

- **Rows**: Quotients 1–12 (the answer values)
- **Columns**: Divisor tables 2–12 (the selected table)
- **Cell at (quotient=3, table=7)**: Represents the fact `21 ÷ 7 = 3`, stored as `factA=7, factB=3, operation="division"`
- **Lookup key**: `${table}-${quotient}` (direct, no min/max normalization)
- **Tooltip**: `"21 ÷ 7 = 3 — Mastered (95%)"` — dividend derived as `table × quotient`

## Division Table Summary Rules

Already implemented:

- For each table (2–12), sum `correct` and `wrong` across all 12 quotient facts for that table
- Accuracy = `round(correct / (correct + wrong) * 100)`
- Card label uses `÷{table}` symbol
- Category thresholds: ≥90% mastered, ≥70% learning, ≥1% struggling, 0 attempts unseen

## Migration / Backward Compatibility Notes

1. **Old multiplication-only records** (no `operation` field in the document): The schema default `"multiplication"` applies on read, and the frontend filter uses `(f.operation || "multiplication")` as a fallback. These records work correctly without migration.

2. **Old compound index**: If the database has the original `(userId, factA, factB)` unique index from before the operation field was added, it must be dropped manually. This is the only action item from this spec. Without dropping it, division fact upserts will fail with duplicate key errors when a user already has a multiplication record for the same number pair.

3. **No data migration needed**: Existing multiplication records don't need any field updates. The schema default handles them.

## Edge Cases

1. **User has only multiplication data, switches to division view**: Shows empty state message "No division data yet..." ✅ Already handled
2. **User has only division data, views multiplication tab**: Shows empty state message ✅ Already handled
3. **Same number pair exists as both multiplication and division fact**: Stored as separate documents due to compound index including `operation` ✅ Already handled
4. **Legacy records without `operation` field**: Treated as multiplication via schema default and frontend fallback ✅ Already handled
5. **Guest plays division game**: No insight recording attempted (gated by `if (user)` in `finishGame`) ✅ Already handled
6. **Loading state**: Shown while fetching, toggle is not visible until data loads or error occurs ✅ Already handled
7. **Error state**: Shown if fetch fails, applies to both operations ✅ Already handled

## Files Confirmed To Exist

All files involved in the division insights pipeline:

- `server/models/factMastery.model.js` — operation-aware schema ✅
- `server/controllers/insightController.js` — operation-aware recording and retrieval ✅
- `server/routes/insightRoutes.js` — unchanged, routes are operation-agnostic ✅
- `client/src/utils/questionGenerator.js` — `generateDivisionRound` with correct fact identity ✅
- `client/src/components/MultiplicationGame/MultiplicationGame.jsx` — operation in question log ✅
- `client/src/hooks/useRecordInsights.js` — operation in payload ✅
- `client/src/hooks/useInsights.js` — fetches all facts ✅
- `client/src/Pages/Insights/Insights.jsx` — toggle, filtering, division heatmap ✅
- `client/src/Pages/Insights/insights.styles.scss` — toggle styles ✅
- `client/src/Pages/Game/Game.jsx` — operation selection flow ✅
- `client/src/components/OperationSelector/OperationSelector.jsx` — operation chooser ✅
- `client/src/components/TableSelector/TableSelector.jsx` — operation-aware heading and symbol ✅

## Files To Create

None.

## Files To Update

None. The implementation is complete.

## Acceptance Criteria

These are verification criteria — testing that the existing implementation works correctly:

- [ ] Playing a division round as an authenticated user creates FactMastery documents with `operation: "division"`
- [ ] Division facts are stored with `factA = table (divisor)` and `factB = quotient` — no min/max normalization
- [ ] Playing a multiplication round still creates facts with `operation: "multiplication"` and commutative normalization
- [ ] The same number pair (e.g., factA=3, factB=7) can exist as both a multiplication and division record for the same user
- [ ] `GET /api/insights` returns facts with the `operation` field
- [ ] The Insights page shows a Multiplication / Division toggle
- [ ] Switching to Division view filters to only division facts
- [ ] Division heatmap has divisor tables (2–12) as columns and quotients (1–12) as rows
- [ ] Division heatmap tooltips show `"{dividend} ÷ {divisor} = {quotient}"` format
- [ ] Division table summary cards show `÷{table}` labels with correct accuracy
- [ ] Empty state is shown per operation when no data exists for that operation
- [ ] Old multiplication-only records (without `operation` field) appear correctly under the Multiplication view
- [ ] The old compound index `(userId, factA, factB)` has been dropped if it exists in the database

## Open Questions

- None at this stage. The implementation is complete.

## Assumptions

- The old `(userId, factA, factB)` index has been dropped in any database that existed before the operation field was added. If not, this is the one required action.
