# Smart Practice Mode — Implementation Spec (Luna Ninjas)

## 1) Scope and Intent

Add **Smart Practice** as a separate mode in gameplay flow. Standard Practice remains exactly as-is (same question generation, scoring, and recording behavior).

Smart Practice must:
- use authenticated user fact performance data already recorded in `FactMastery`
- be operation-aware (multiplication and division are isolated)
- generate targeted rounds biased toward weak facts, while still including learning/strong/unseen facts
- avoid personalization for guests (safe fallback defined below)

---

## 2) Current-System Constraints This Spec Builds On

- Game flow is currently operation selection → table selection → game screen.
- Facts are already persisted per user with `factA`, `factB`, `operation`, `correct`, `wrong`, `lastSeen`.
- Multiplication facts are normalized commutatively at record time; division facts are stored as `(table, quotient)`.
- Round generation is currently pure client-side random by selected table + operation.

Smart Practice is designed to fit this architecture with minimal disruption.

---

## 3) Hard Product Decisions

### 3.1 UI Flow (final)

New flow on `/game`:
1. **OperationSelector** (existing) — choose Multiplication or Division.
2. **PracticeModeSelector** (new) — choose:
   - Standard Practice
   - Smart Practice
3. **TableSelector** (existing) — still required in both modes.
4. **MultiplicationGame** (existing component) runs selected mode.

Why this order:
- Operation must be chosen before Smart logic because Smart is strictly operation-aware.
- Mode choice before table clarifies whether user expects random or targeted round.
- Table remains explicit to preserve current mental model and scoring map.

### 3.2 Table-Specific vs Cross-Table Behavior (final)

**Decision: Smart Practice is table-specific within the selected operation.**

- If user selects multiplication + table 7, Smart candidates are only facts in multiplication table 7 (`7×1..12`, commutatively resolved).
- If user selects division + table 7, Smart candidates are only facts `7÷q` / `7*q ÷ 7` for `q=1..12`.
- No cross-table pulling in a round.

Rationale: aligns with current explicit table pick and weight-based scoring; avoids hidden difficulty jumps.

### 3.3 Fact Strength Thresholds (final)

Classification is computed per fact using `attempts = correct + wrong` and `accuracy = correct / attempts`.

- **unseen**: `attempts = 0`
- **weak**: `attempts >= 2` and `accuracy < 0.60`
- **learning**: `attempts >= 2` and `0.60 <= accuracy < 0.85`
- **strong**: `attempts >= 2` and `accuracy >= 0.85`
- bootstrap facts with `attempts = 1` are treated as **learning** (never weak yet)

Recency tie-breaker for intra-bucket priority:
- older `lastSeen` first
- then lower `accuracy`
- then higher attempts

### 3.4 Round Composition (final)

Each Smart round remains 12 questions.

Target composition (before fallback adjustment):
- 6 weak
- 3 learning
- 2 unseen
- 1 strong

Constraints:
- max 2 repeats of any single fact in one round
- at least 6 unique facts per round
- weak facts are prioritized for repeats only when weak pool is small

Fallback fill order when a bucket is short:
1. weak
2. learning
3. unseen
4. strong

This guarantees a balanced round (not all weak) while remaining targeted.

### 3.5 Low-Data Fallback (final)

Low-data condition (for selected operation + table): fewer than 6 attempted facts.

Behavior:
- Smart mode still starts (no hard block)
- composition shifts to exploration-heavy:
  - 3 weak (if available)
  - 3 learning (if available)
  - 4 unseen
  - 2 strong (if available)
- if all facts unseen, Smart round becomes a deterministic shuffled full-table round (functionally random but still mode-specific)

User message on start card:
- “Building your Smart profile for this table — this round includes more discovery facts.”

### 3.6 Guest Behavior (final)

**Decision: guests cannot run personalized Smart Practice.**

- If not authenticated and user selects Smart Practice, show a gated card:
  - title: “Smart Practice requires an account”
  - actions: Sign in / Register / Continue with Standard
- Continue with Standard keeps current guest behavior unchanged.

No pseudo-personalization using localStorage in this feature.

### 3.7 Client-side vs Backend Generation (final)

**Decision: Hybrid.**

- **Backend** returns a per-user per-operation per-table Smart fact plan (ranked candidates + bucket labels).
- **Client** composes final 12-question round from plan using deterministic bucket quotas/fallback and existing option-generation utilities.

Why:
- user mastery data lives in DB and should remain authoritative server-side
- avoids shipping full insight logic and history queries to client
- preserves fast UI and reuse of existing question shape and answer-option generation

Endpoint contract:
- `GET /api/insights/smart-round?operation=<op>&table=<2..12>`
- auth required
- returns:
  - `facts`: array of `{ a, b, operation, bucket, attempts, accuracy, priorityScore }`
  - `lowData`: boolean
  - `generatedAt`

No scores are computed server-side for Smart (existing score submit flow unchanged).

---

## 4) Fact Identity Rules (must match existing storage semantics)

### Multiplication Smart lookup
- selected table `t`
- candidate canonical keys are `(min(t,m), max(t,m))` for `m=1..12`
- operation filter strictly `multiplication`

### Division Smart lookup
- selected table `t`
- candidate keys are `(t,q)` for `q=1..12`
- operation filter strictly `division`

Cross-operation contamination is disallowed.

---

## 5) Detailed Generation Algorithm

1. Client requests smart plan for selected `operation` + `table`.
2. Backend constructs 12 canonical facts for that operation/table.
3. Backend joins against `FactMastery` for authenticated user and assigns bucket per threshold rules.
4. Backend sorts each bucket by priority (`oldest lastSeen`, then lower accuracy, then higher attempts).
5. Client consumes plan and allocates slots by target quotas.
6. Client fills shortages using fallback order.
7. Client enforces uniqueness/repeat constraints.
8. Client converts facts to existing question objects:
   - multiplication question text and answer semantics unchanged
   - division question text and answer semantics unchanged
9. Gameplay, scoring, and insight recording proceed through current paths.

---

## 6) Exact File Impact

## Client

1. **New** `client/src/components/PracticeModeSelector/PracticeModeSelector.jsx`
   - 2-card selector: Standard vs Smart
   - receives `onSelect(mode)`

2. **New** `client/src/components/PracticeModeSelector/practice-mode-selector.styles.scss`

3. **Modify** `client/src/Pages/Game/Game.jsx`
   - add `selectedMode` state: `"standard" | "smart"`
   - insert PracticeModeSelector between operation and table
   - pass `mode` into `MultiplicationGame`
   - reset mode in `handlePlayAgain`

4. **Modify** `client/src/components/MultiplicationGame/MultiplicationGame.jsx`
   - accept new prop `mode`
   - on start:
     - standard: current `generateRound` / `generateDivisionRound`
     - smart + authed: fetch smart plan and build Smart round
     - smart + guest: show gate UI + Standard CTA
   - add low-data explanatory copy in pre-game panel when `mode=smart && lowData`
   - do not alter score/life/timer rules

5. **New** `client/src/hooks/useSmartRound.js`
   - authenticated fetch hook for `/api/insights/smart-round`
   - returns `{ fetchSmartRound, loading, error }`

6. **Modify** `client/src/utils/questionGenerator.js`
   - add helper(s) to build question objects from explicit fact lists (no random table sweep)
   - keep existing standard generators untouched

7. **Modify** `client/src/components/OperationSelector/OperationSelector.jsx` (copy only)
   - subtitle tweak to mention next step includes practice mode

## Server

8. **Modify** `server/controllers/insightController.js`
   - add `getSmartRoundPlan` handler
   - validates `operation` and `table`
   - builds canonical fact set, fetches user records, computes buckets/priority, returns plan

9. **Modify** `server/routes/insightRoutes.js`
   - add `GET /smart-round` (auth required)

10. **No schema changes** `server/models/factMastery.model.js`
   - existing fields are sufficient

11. **No changes** score routes/controllers
   - Smart mode uses existing scoring submission path unchanged

## Tests

12. **New** `server/tests/insights.smart-round.test.js`
   - bucket classification test cases
   - operation isolation test
   - table-specific selection test
   - low-data response flag test

13. **Modify** `client/src/utils/questionGenerator.test.js`
   - tests for question construction from smart fact list
   - repeat and unique constraints behavior

14. **New** `client/src/hooks/useSmartRound.test.js` (if test setup supports hooks)

---

## 7) API Validation Rules

`GET /api/insights/smart-round`
- requires auth token
- `operation` required, one of `multiplication | division`
- `table` required integer `2..12`
- 400 for invalid query
- 401 for missing/invalid auth

Response shape:
- always returns exactly 12 canonical fact candidates in `facts` (bucketed), even if unseen
- client is responsible for final quota composition and repeat policy

---

## 8) Non-Regression Requirements

- Standard mode generation logic and UX remain identical.
- Existing Insights page behavior remains unchanged.
- Existing score submission and leaderboard semantics remain unchanged.
- Existing fact recording payload and schema remain unchanged.

---

## 9) Acceptance Criteria

1. User can explicitly choose Standard or Smart after selecting operation.
2. Standard rounds are byte-for-byte behavior equivalent to current implementation.
3. Smart multiplication uses only multiplication facts; Smart division uses only division facts.
4. Smart rounds use selected table only.
5. Smart rounds include mixed buckets and are not exclusively weak facts.
6. Smart low-data behavior triggers under `<6 attempted facts` and shows discovery message.
7. Guests selecting Smart are gated and offered Sign in/Register/Continue Standard.
8. Backend smart endpoint rejects invalid operation/table and requires auth.
9. Smart mode still records insights and scores through existing endpoints after round completion.
