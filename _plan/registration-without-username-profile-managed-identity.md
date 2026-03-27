# Registration Without Username + Profile-Managed Public Identity

## Summary

Refactor the auth identity flow so initial registration only collects `fullName`, `email`, and `password`, while `username` becomes optional profile metadata managed after signup. Public identity on leaderboard must consistently use `username || fullName` (never `displayName`), aligning backend responses, frontend rendering, and profile editing semantics with the requested UX.

## Goal

Registration is simpler and friction-free, usernames are set later from Profile, and leaderboard naming is deterministic and consistent across the app using `username` first and `fullName` as fallback.

## Non-Goals

- Reworking login mechanics, JWT issuance, or auth middleware behavior.
- Rebuilding profile UI layout beyond identity-field behavior updates.
- Changing scoring, ranking sort order, or leaderboard pagination limits.
- Introducing new identity fields beyond existing `fullName`, `username`, `displayName`.

## Problem

The current implementation supports optional username at registration and simultaneously maintains `displayName` as a competing identity source. Leaderboard currently prioritizes `displayName`, which conflicts with the requested rule (`username || fullName`) and can display stale or unintended names. This creates product inconsistency and unclear source-of-truth identity semantics.

## Users / Actors

- **New registrant** creating an account for the first time.
- **Authenticated user** editing profile metadata (including optional username).
- **Public visitor / any user** viewing leaderboard identities.

## Core Requirements

1. Registration (`POST /api/auth/register`) accepts only `fullName`, `email`, and `password` as user-input fields.
2. Register endpoint must not require or validate username for successful signup.
3. Username lifecycle moves fully to Profile update (`PATCH /api/auth/profile`).
4. Profile supports add, edit, and remove/clear username.
5. Username remains globally unique when set.
6. Username normalization remains lowercase + trim.
7. Blank username in profile update is treated as “remove username” (persisted as `undefined`/unset).
8. Leaderboard display name rule is **exactly**: `username || fullName`.
9. Leaderboard must stop using `displayName` in name derivation.
10. Existing users without username remain valid and display fullName on leaderboard.
11. Existing users with username continue displaying username first.
12. `displayName` is no longer used as public identity source for leaderboard or auth header identity policy (see naming section).

## User Flows

### 1) Register (new behavior)
1. User opens `/register`.
2. Form asks only: Full name, Email, Password.
3. Submit sends payload without username.
4. Backend creates user and returns token + safe user object.
5. User is logged in and redirected as today.

### 2) Login (unchanged)
1. User logs in with email/password.
2. JWT + safe user response shape remains compatible with current auth context.
3. Hydration via `/api/auth/me` remains unchanged in mechanism.

### 3) Add username later
1. User opens `/profile`.
2. User enters username and saves.
3. Backend validates format + uniqueness; stores normalized lowercase username.
4. Auth context updates user state from response.
5. Leaderboard now shows username for that user.

### 4) Remove username
1. User clears username input and saves profile.
2. Backend treats blank username as unset.
3. Leaderboard falls back to fullName.

### 5) Users who never set username
- They continue normally with no blocked flows.
- Leaderboard and identity fallbacks always render fullName.

## Functional Details

### Current-State Audit (grounded in codebase)

- **Register endpoint currently accepts username**: `registerUser` reads `fullName, email, password, username`; validates username format and uniqueness when present; sets `displayName = fullName`; includes username in created user doc. (`server/controllers/authController.js`)
- **User schema already supports needed fields**: `fullName`, optional `username` (sparse unique index), `displayName`, `profileImage`, `totalScore`, `gamesPlayed`. (`server/models/user.model.js`)
- **Auth routes already expose register/login/me/profile update** and need no new endpoints for this feature. (`server/routes/authRoutes.js`)
- **Profile update already supports username editing** with current format validation, uniqueness checks, and blank→unset normalization. (`server/controllers/authController.js`)
- **Leaderboard name derivation is inconsistent with requested behavior**: currently `displayName -> username -> fullName`. (`server/controllers/scoreController.js`)
- **Register page currently includes optional username field** and handles `username_taken` errors. (`client/src/Pages/Register/Register.jsx`)
- **Profile page already includes editable username and displayName fields**. (`client/src/Pages/Profile/Profile.jsx`)
- **Auth hydration flow is server-backed** (`/api/auth/me`) and should remain compatible; context stores response user as source of truth. (`client/src/context/AuthContext.jsx`)
- **Header currently renders `user.displayName`**, which conflicts with a deterministic `username || fullName` public identity direction. (`client/src/components/Header/Header.jsx`)

### Inconsistencies vs requested flow

1. Username is surfaced during registration UI and validated during register API path.
2. Public identity selection in leaderboard is driven by `displayName` first.
3. App-level identity surfaces (header/profile semantics) do not consistently express `username` as optional handle layered on top of `fullName`.

### Backend Behavior Changes

#### A) `POST /api/auth/register`

**Request contract (final):**
```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}
```

- Required validation: `fullName`, `email`, `password` only.
- Remove username parsing/validation/uniqueness checks from register flow.
- If `username` is sent by older clients, backend should **ignore it** (recommended for backward compatibility) rather than fail hard.
- Continue lowercasing email and trimming fullName.
- Continue password min-length behavior (>= 8).
- Continue email uniqueness conflict response: `409 { error: "email_taken" }`.

**Response contract (no breaking change):**
- Keep `{ token, user }` with safe user shape; `user.username` may be undefined.
- No change required to `safeUser`, except ensure it does not imply username presence.

#### B) `PATCH /api/auth/profile`

- Retain username management here as single write path.
- Keep format rule: `^[a-z0-9_]{3,30}$` after trim/lowercase.
- Keep uniqueness check excluding current user.
- Blank input behavior: `""` or whitespace-only -> unset username.
- Duplicate behavior unchanged: `409 { error: "username_taken" }`.

#### C) Leaderboard endpoint behavior

- In `getLeaderboard`, derive entry `name` using **only**:
  1. trimmed `username` if present
  2. otherwise trimmed `fullName`
- Do not include `displayName` in ranking name resolution.
- Keep sort, limit, and score payload unchanged.

#### D) `displayName` in backend

**Recommendation:** keep field for now (no migration risk), but deprecate it from identity decision paths.
- Do not use `displayName` for leaderboard naming.
- Do not rely on `displayName` in auth/user-facing identity policy.
- Cleanup/deletion can be a separate follow-up once all consumers are removed.

### Frontend Behavior Changes

#### A) Register page (`/register`)

- Remove username field UI and corresponding client validation/error display.
- Submit payload only includes `fullName`, `email`, `password`.
- Remove handling of `username_taken` in register flow.
- Keep success behavior unchanged (login + redirect).
- Update helper copy to clarify username can be set later in profile.

#### B) Profile page (`/profile`)

- Keep username input editable (add/update/remove).
- Ensure UX explicitly marks username optional and changeable anytime.
- Preserve displayName input only if product keeps it (see naming policy); otherwise hide/deprecate from form in this same feature scope.

#### C) Auth context and hydration

- No architectural changes required; ensure flows are tolerant of missing username for new users.
- `/api/auth/me` response already includes `fullName`, `username`, `displayName`; frontend should not assume username exists.

#### D) Header/nav identity rendering

- Update displayed signed-in label to follow app identity policy:
  - Preferred: `user.username || user.fullName`
- Stop showing `displayName` in header identity label.

#### E) Leaderboard UI/data flow

- No structural UI changes required; consumes `entry.name`.
- Update any docs/comments/types that mention `displayName` in leaderboard data contract.

### Naming and Identity Rules (single source-of-truth policy)

#### `fullName`
- Required legal/profile name collected at registration.
- Must always exist for every user.
- Default fallback identity anywhere name is required.

#### `username`
- Optional public handle managed only through profile updates.
- Must be unique globally when present.
- Preferred public identity for leaderboard and signed-in identity labels.

#### `displayName`
**Decisive recommendation: deprecate from active identity flow now; do not remove schema yet in this change.**

Rationale:
- Requested UX is explicitly `username || fullName`.
- `displayName` introduces third-source ambiguity and stale identity risk.
- Existing app can satisfy requirements without schema-breaking migration by stopping read/write reliance first.

Implementation policy for this feature:
- `displayName` excluded from leaderboard naming.
- `displayName` not used in header identity rendering.
- Prefer removing editable `displayName` control from Profile UI in this same refactor to avoid contradictory UX.
- Physical field removal/migration deferred to a later cleanup ticket.

### API and Validation Details

#### Register validation (backend)
- `fullName`: required, non-empty after trim.
- `email`: required, non-empty after trim, lowercased.
- `password`: required, minimum 8 chars.
- `username`: not validated in register path; ignored if sent.

#### Register validation (frontend)
- Mirror backend requirements: fullName/email/password only.
- No username validation or conflict handling in register UI.

#### Profile update username validation
- Normalize: trim + lowercase.
- Pattern: `^[a-z0-9_]{3,30}$` when non-empty.
- Blank username (`""`/whitespace) => unset username.
- Duplicate username => 409 `username_taken`.

### Leaderboard Behavior

Final display rule:
- `name = normalized(username) || normalized(fullName)`

Required changes for consistency:
1. Backend leaderboard mapper in `scoreController.getLeaderboard` removes `displayName` from name preference chain.
2. Frontend leaderboard remains consuming `entry.name`; no fallback logic in component.
3. Any comments/docs/hooks that refer to leaderboard `displayName` must be updated to `name` derived from username/fullName.

## States and Edge Cases

- Register request from stale client still sending `username` should not break signup (ignored server-side).
- Existing users with username continue to display username on leaderboard.
- Existing users without username display fullName.
- Existing users with only `displayName` customizations no longer influence leaderboard name.
- Username with uppercase or surrounding spaces is normalized on profile update.
- Username clear action should remove sparse-unique indexed value cleanly (avoid storing empty string).
- `fullName` blank update in profile remains rejected.
- `/api/auth/me` remains backward compatible for auth bootstrap.

## Technical Notes

- No DB migration strictly required for core feature.
- Sparse unique index on `username` already supports optional usernames.
- If profile UI removes `displayName` field, backend may still accept it temporarily for compatibility; mark as deprecated in controller comments.
- Keep safe user payload stable to avoid auth context churn.
- Consider adding a short deprecation comment in auth controller near `displayName` usage to guide future cleanup.

### Impacted Files

#### Backend files to modify
- `server/controllers/authController.js`
  - Register: remove username requirement/validation/uniqueness from register flow.
  - Optional cleanup: reduce displayName coupling.
- `server/controllers/scoreController.js`
  - Leaderboard name policy to `username || fullName`.

#### Backend files likely unchanged but reviewed
- `server/models/user.model.js` (schema likely unchanged in this feature).
- `server/routes/authRoutes.js` (no route shape changes expected).

#### Frontend files to modify
- `client/src/Pages/Register/Register.jsx`
  - Remove username field, payload key, username error handling.
- `client/src/Pages/Profile/Profile.jsx`
  - Keep username editable; deprecate/remove displayName editing UI per naming policy.
- `client/src/components/Header/Header.jsx`
  - Use `username || fullName` for signed-in label.
- `client/src/hooks/useLeaderboard.js`
  - Update inline contract comments away from `displayName` wording.

#### Tests to update/add
- Backend auth controller tests (register + profile update behavior).
- Backend leaderboard controller tests (name precedence).
- Frontend register page tests.
- Frontend profile username editing tests.
- Frontend header/leaderboard rendering tests (identity fallback logic).

#### Cleanup targets (if displayName deprecation continues)
- `authController.safeUser` and `getMe` payload shaping.
- profile form state and API payload fields.
- any UI text/components still referencing displayName as primary identity.

## Acceptance Criteria

- [ ] Register UI contains only Full name, Email, Password.
- [ ] Register API succeeds without username and does not require username.
- [ ] Register API still rejects missing required fields (`fullName`, `email`, `password`).
- [ ] Profile can add a username after signup.
- [ ] Profile can update an existing username.
- [ ] Profile duplicate username returns `409 { error: "username_taken" }` and surfaces inline error.
- [ ] Clearing username in profile removes it (not empty-string persisted).
- [ ] Leaderboard shows username when present.
- [ ] Leaderboard shows fullName when username missing.
- [ ] Leaderboard no longer uses displayName in name selection.
- [ ] Existing users with no username still render correctly across header/leaderboard.
- [ ] `/api/auth/me` and auth context bootstrap continue working with users that have undefined username.

## Open Questions

- Should profile UI remove `displayName` input immediately in this feature, or keep it hidden behind a compatibility flag?  
  **Recommendation:** remove from UI now, keep backend field temporarily for non-breaking transition.

## Assumptions

- Existing automated tests either exist or will be introduced alongside implementation for auth/profile/leaderboard flows.
- No third-party integration depends on leaderboard `displayName` precedence.
- Product accepts backend tolerance for legacy clients sending register `username`.

## File Naming

This spec is saved as:
`_plan/registration-without-username-profile-managed-identity.md`
