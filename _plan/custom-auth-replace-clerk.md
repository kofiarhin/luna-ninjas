# Remove Clerk — Custom Full-Stack Auth System

## Summary

Replace Clerk with a self-contained auth system. Users register with fullName, email, password, and an optional unique username. The backend issues its own JWTs. Every Clerk-dependent file — middleware, routes, controllers, React hooks, pages, the header UI, tests, env vars, and both package.json files — is updated or replaced as part of this migration.

## Goal

The app has zero Clerk code, zero Clerk packages, and zero Clerk environment variables. Auth works end-to-end using custom JWTs. All existing features (protected routes, score submission, leaderboard identity, tests) continue to work.

## Non-Goals

- Social / OAuth login (Google, GitHub, etc.)
- Email verification or password-reset flows (can be added later)
- Role-based access control beyond "authenticated vs. unauthenticated"
- Changing game logic, scoring, or leaderboard logic
- Backend logout endpoint (stateless JWT; client-side removal is sufficient for v1)

## Problem

Clerk is a third-party auth service that controls identity, session management, and UI. Removing it eliminates the external dependency, removes per-MAU billing risk, and gives the team full control over the auth schema (adding `username`, `password`, etc.).

## Users / Actors

- **Visitor** — not logged in; can view home and leaderboard
- **Registered user** — logged in; can play the game and submit scores

---

## Core Requirements

1. Users can register with `fullName`, `email`, `password`, and an optional `username`.
2. If `username` is provided it must be unique across all users. It is trimmed and lowercased before validation, uniqueness checks, and storage. An empty or whitespace-only string is treated as omitted.
3. `email` must be unique across all users.
4. Passwords are hashed with bcrypt before storage; plain-text passwords are never stored or logged.
5. Login accepts `email` + `password` and returns a signed JWT.
6. The JWT payload contains only the MongoDB `_id`. No user data is encoded in the token.
7. JWTs expire after 7 days. No refresh-token flow is required.
8. A custom Express middleware `authMiddleware` verifies the Bearer token and sets `req.auth.userId` to the MongoDB `_id` string — the same shape the existing controllers already consume.
9. `POST /api/scores` and `GET /api/auth/me` are protected by `authMiddleware`. No other endpoints change their auth posture.
10. `POST /api/auth/register` and `POST /api/auth/login` are public.
11. `GET /api/leaderboard` remains public.
12. The `/post-signup` route and `PostSignUp` component are removed; registration now happens in a single request.
13. Frontend stores the JWT in `localStorage` under the key `luna_token`.
14. A React `AuthContext` replaces `ClerkProvider`; it exposes `{ user, token, login, logout, isLoaded }`.
15. On app load, if `luna_token` exists, `AuthContext` calls `GET /api/auth/me` to hydrate `user` from the server. The token is never decoded client-side as the source of user data.
16. `useSubmitScore` reads the token from context instead of calling Clerk's `getToken()`.
17. Protected route `/game` redirects to `/login` if `AuthContext.user` is null after `isLoaded` is true.
18. The header shows user controls (display name + logout button) when authenticated, or Login/Register links when not.
19. `@clerk/express` and `@clerk/clerk-react` are removed from both `package.json` files.
20. `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY` are removed from all `.env` files; `JWT_SECRET` is added to the root `.env`.
21. The test suite is updated: `clerkAuth` mock is replaced with a custom-token injection pattern; all existing test cases still pass. Tests for `GET /api/auth/me` are added.
22. `POST /api/scores` requires the authenticated user to already exist in the database. If the user record is not found, return 404 — no silent upsert or auto-creation fallback.

---

## User Flows

### Register
1. User navigates to `/register`.
2. Fills in: Full Name (required), Email (required), Password (required), Username (optional).
3. Submits → `POST /api/auth/register`.
4. On success: backend returns `{ token, user }`. Frontend stores token, calls `login(token, user)`, redirects to `/game`.
5. On failure: inline validation messages (duplicate email, duplicate username, missing fields).

### Login
1. User navigates to `/login`.
2. Fills in: Email + Password.
3. Submits → `POST /api/auth/login`.
4. On success: backend returns `{ token, user }`. Frontend stores token, calls `login(token, user)`, redirects to `/game`.
5. On failure: "Invalid email or password" (single message — no field-level hints for security).

### Auth persistence on app load
1. App mounts; `AuthContext` reads `luna_token` from `localStorage`.
2. If token exists, sends `GET /api/auth/me` with `Authorization: Bearer <token>`.
3. If the response is 200, sets `user` from the response body and `isLoaded = true`.
4. If the response is 401 (expired, invalid, or missing), removes token from `localStorage`, sets `user = null`, and `isLoaded = true`.
5. If no token in `localStorage`, sets `user = null` and `isLoaded = true` immediately (no network request).

### Play game & submit score
1. `/game` checks `AuthContext.user`; if null after `isLoaded`, redirects to `/login`.
2. After a round, `useSubmitScore` reads `token` from context, sends `Authorization: Bearer <token>`.
3. `authMiddleware` verifies token, sets `req.auth.userId` to MongoDB `_id`.
4. `scoreController` calls `User.findById(userId)`. If no user found, returns 404 — no auto-creation.
5. Atomically increments `totalScore` and `gamesPlayed`.

### Logout
1. User clicks logout button in header.
2. `AuthContext.logout()` removes `luna_token` from `localStorage` and resets `user` and `token` to null.
3. User is redirected to `/home`.
4. No backend request is made. The JWT remains technically valid until expiry; this is acceptable for v1.

---

## Functional Details

### UI / Pages / Components

**`/register` — new custom form**
- Fields: Full Name, Email, Password (min 8 chars), Username (optional, label "Username (optional)")
- Submit button disabled while request in flight
- Error banner for API errors; per-field errors for required-field violations

**`/login` — new custom form**
- Fields: Email, Password
- Same loading/error pattern

**`PostSignUp` page — deleted**
- The `/post-signup` route and its component are removed entirely.

**`Header` — updated**
- Remove all Clerk imports (`SignedIn`, `SignedOut`, `UserButton`)
- Use `AuthContext`: if `user` is set, show `user.displayName` and a Logout button; otherwise show Login / Register links
- "Game" nav link: conditionally render only when `user` is set (mirrors existing `<SignedIn>` behavior)

**`AuthContext` — new file `client/src/context/AuthContext.jsx`**
```
State: { user, token, isLoaded }
Actions:
  login(token, user)  — stores token in localStorage, sets user and token in state
  logout()            — removes luna_token from localStorage, sets user and token to null

Init (on mount):
  1. Read luna_token from localStorage
  2. If present, call GET /api/auth/me with Bearer token
     - On 200: set user from response, set token, set isLoaded = true
     - On 401 / error: remove token from localStorage, set user = null, set isLoaded = true
  3. If absent: set user = null, token = null, isLoaded = true immediately

Expose via useAuth() hook exported from same file
```

### Routing / Navigation

Changes to `App.jsx`:
- Remove `ClerkProvider`, `SignedIn`, `SignedOut` imports
- Wrap app in `<AuthProvider>` instead of `<ClerkProvider>`
- Replace `<SignedIn>/<SignedOut>` guards with a `<PrivateRoute>` component that reads from `AuthContext`
- `<PrivateRoute>` renders a loading state while `isLoaded` is false, then redirects to `/login` if `user` is null
- Remove `/post-signup` route
- Keep `/login` and `/register` paths but render custom components (not Clerk's)

### Authentication / Authorization

**`server/middleware/authMiddleware.js`** (replaces `clerkAuth.js`)
```
1. Extract Bearer token from Authorization header
2. Verify with jwt.verify(token, process.env.JWT_SECRET)
3. Set req.auth = { userId: decoded._id }
4. Return 401 if token missing, expired, or invalid
5. Warn on startup if JWT_SECRET is missing (mirrors existing clerkAuth.js warning)
```

### Backend — API Endpoints

#### `POST /api/auth/register`
Request body:
```json
{
  "fullName": "Laura Bolas",
  "email": "laura@example.com",
  "password": "hunter12",
  "username": "laura"
}
```
Logic:
1. Validate required fields; return 400 with field errors if missing.
2. Check email uniqueness → 409 `{ error: "email_taken" }`.
3. If username provided (non-empty after trim): normalize to lowercase, check uniqueness → 409 `{ error: "username_taken" }`.
4. Hash password with `bcrypt.hash(password, 10)`.
5. Derive `displayName` from `fullName` (trim).
6. Create User document.
7. Sign JWT: `jwt.sign({ _id: user._id }, JWT_SECRET, { expiresIn: "7d" })`.
8. Return `201 { token, user: { _id, displayName, email, username } }`.

#### `POST /api/auth/login`
Request body:
```json
{ "email": "laura@example.com", "password": "hunter12" }
```
Logic:
1. Find user by email (include `passwordHash` in this query only).
2. If not found or bcrypt compare fails → 401 `{ error: "invalid_credentials" }`.
3. Sign and return JWT same as register.
4. Return `200 { token, user: { _id, displayName, email, username } }`.

#### `GET /api/auth/me` — new, protected
- Protected by `authMiddleware`.
- Calls `User.findById(req.auth.userId)`.
- If not found → 404 `{ error: "user_not_found" }`.
- Returns `200 { _id, displayName, email, username, totalScore, gamesPlayed }`.
- Never returns `passwordHash`.
- Used by `AuthContext` on app load to hydrate and verify persisted auth state.

#### `POST /api/scores` — middleware swapped, upsert removed
- Remove `clerkAuth` import, add `authMiddleware` import in `scoreRoutes.js`.
- Change `User.findOne({ clerkUserId: userId })` → `User.findById(userId)`.
- Remove the upsert / auto-creation fallback entirely. If `findById` returns null, respond `404 { error: "user_not_found" }`.
- All other score logic (recompute server-side, atomic `$inc`) remains unchanged.

#### `GET /api/leaderboard` — no changes

### Validation

| Field | Rule |
|---|---|
| fullName | Required, non-empty string, max 100 chars |
| email | Required, valid email format, unique |
| password | Required, min 8 chars |
| username | Optional; if provided after trim: lowercase, alphanumeric + underscores only, 3–30 chars, unique |

All validation errors return `400 { errors: { fieldName: "message" } }`.

### Database Changes

**User model (`server/models/user.model.js`)** — update schema:

| Field | Change |
|---|---|
| `clerkUserId` | **Remove** |
| `firstName` | **Remove** (replaced by fullName) |
| `lastName` | **Remove** (replaced by fullName) |
| `imageUrl` | **Remove** (Clerk-specific) |
| `passwordHash` | **Add** — String, required |
| `fullName` | **Add** — String, required |
| `username` | **Add** — String, optional, stored lowercase, unique sparse index |
| `email` | Keep, add unique index |
| `displayName` | Keep — set from `fullName` at registration |
| `totalScore` | Keep |
| `gamesPlayed` | Keep |

> **Note:** No production user data needs preserving. Drop and re-create the `users` collection in dev/staging.

### Package Cleanup

**Root `package.json`:**
- Remove `@clerk/express`
- Add `bcryptjs` and `jsonwebtoken`

**`client/package.json`:**
- Remove `@clerk/clerk-react`
- No new packages required (React context API is built-in)

### Environment Variables

**Root `.env`:**
```
# Remove:
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=

# Add:
JWT_SECRET=<random 64-char secret>
```

**`client/.env`:**
```
# Remove:
VITE_CLERK_PUBLISHABLE_KEY=
```

Update `CLAUDE.md` env section accordingly.

---

## File Impact

### Files Confirmed To Exist

These files are confirmed present in the repo and are affected by this migration:

**Backend**
- `server/middleware/clerkAuth.js` — deleted; replaced by `authMiddleware.js`
- `server/routes/authRoutes.js` — updated: new register/login routes + add `GET /api/auth/me`
- `server/routes/scoreRoutes.js` — updated: swap `clerkAuth` for `authMiddleware`
- `server/controllers/authController.js` — rewritten: new register/login logic + `me` handler
- `server/controllers/scoreController.js` — updated: remove upsert, use `findById`
- `server/models/user.model.js` — updated: schema changes as listed above
- `server/tests/scores.test.js` — updated: replace Clerk mock, add `/me` tests

**Frontend**
- `client/src/main.jsx` — updated: remove `ClerkProvider`, add `AuthProvider`
- `client/src/App.jsx` — updated: replace Clerk guards with `PrivateRoute`, remove `/post-signup` route
- `client/src/Pages/Login/Login.jsx` — rewritten: custom form replacing Clerk `<SignIn>`
- `client/src/Pages/Register/Register.jsx` — rewritten: custom form replacing Clerk `<SignUp>`
- `client/src/Pages/PostSignUp/PostSignUp.jsx` — deleted
- `client/src/components/Header/Header.jsx` — updated: remove Clerk UI components, use `AuthContext`
- `client/src/hooks/useSubmitScore.js` — updated: read token from `AuthContext` instead of `useAuth()`

**Configuration**
- `.env` (root) — remove Clerk vars, add `JWT_SECRET`
- `client/.env` — remove `VITE_CLERK_PUBLISHABLE_KEY`
- `CLAUDE.md` — update env section, auth middleware description, remove Clerk gotcha note
- `package.json` (root) — remove `@clerk/express`, add `bcryptjs`, `jsonwebtoken`
- `client/package.json` — remove `@clerk/clerk-react`

### Files To Create

- `server/middleware/authMiddleware.js` — custom JWT verification middleware
- `client/src/context/AuthContext.jsx` — auth state, `/me` hydration, login/logout actions

### Files To Update (no Clerk references, but touched by new auth shape)

- `server/routes/authRoutes.js` — add `GET /api/auth/me` route pointing to new controller handler

---

## States and Edge Cases

| Scenario | Behavior |
|---|---|
| Token expired on app load | `/me` returns 401; token cleared from `localStorage`; `user = null`; `isLoaded = true` |
| Token expired mid-session (score submit) | `authMiddleware` returns 401; `useSubmitScore` surfaces "Session expired — please log in again" and clears stored token |
| Token malformed in `localStorage` | `authMiddleware` returns 401; `AuthContext` clears token, sets `user = null` |
| Username field left blank or whitespace-only | Treated as omitted; stored as `undefined`; sparse unique index allows multiple nulls |
| Username submitted with mixed case | Trimmed and lowercased before validation and save (e.g. `"Laura"` → `"laura"`) |
| Email already registered | 409 `{ error: "email_taken" }` |
| Username already taken (case-insensitive) | 409 `{ error: "username_taken" }` |
| Wrong password | 401 `{ error: "invalid_credentials" }` — same message as "user not found" to prevent email enumeration |
| Score submitted while `isLoaded` is false | `useSubmitScore` early-returns; no request sent |
| Authenticated user not found in DB on score submit | 404 `{ error: "user_not_found" }` — no silent upsert |
| `GET /api/auth/me` with valid token but deleted user | 404 `{ error: "user_not_found" }`; `AuthContext` clears token, sets `user = null` |
| `JWT_SECRET` missing from env | Server warns on startup; throws at runtime on first sign/verify |
| User navigates to `/game` while not logged in | `PrivateRoute` redirects to `/login` |
| User navigates to `/game` while `isLoaded` is false | `PrivateRoute` renders loading state until hydration resolves |
| User navigates to `/login` while already logged in | Redirect to `/game` |
| Logout | Token removed from `localStorage`; `user` and `token` set to null; redirect to `/home`; no backend call |

---

## Technical Notes

- `jsonwebtoken` and `bcryptjs` are added to the root (server) package. `bcryptjs` is the pure-JS version — prefer it over `bcrypt` to avoid native build issues on Windows.
- The JWT payload contains only `{ _id }`. Do not encode email, username, roles, or display name in the token; always fetch fresh data from `GET /api/auth/me`.
- `GET /api/auth/me` is the single source of truth for `AuthContext.user` on load. No client-side JWT decoding (`atob`, `jwt-decode`) should be used to derive user state.
- `scoreController.js` currently uses `findOne({ clerkUserId })` with an upsert fallback. Both the `clerkUserId` lookup and the upsert must be removed. Use `User.findById(req.auth.userId)` with a hard 404 if no document found.
- `useLeaderboard.js` has no Clerk dependency — no changes needed.
- `questionRoutes.js` / `questionController.js` — audit confirmed no Clerk imports; no changes needed.
- Backend logout endpoint is intentionally omitted for v1. The JWT remains valid until expiry after client-side logout; this is an acceptable trade-off for a stateless system without a token blocklist. A blocklist or short-lived token strategy can be layered in later.
- `CLAUDE.md` must be updated: remove Clerk gotcha note, update env section, update auth middleware description to reflect `authMiddleware.js`.

---

## Tests

### Updates to `server/tests/scores.test.js`

Replace the Clerk middleware mock with a pattern that injects a valid signed JWT or uses a test helper that sets `req.auth.userId` directly — matching the shape `authMiddleware` produces.

All existing test cases must continue to pass:
- 401 without auth token
- 400 validation on table/correctCount
- 200 on valid submission
- Leaderboard does not expose `passwordHash`, `email`, or `_id`

### New tests for `GET /api/auth/me`

- **Valid token** → 200 with `{ _id, displayName, email, username, totalScore, gamesPlayed }`; `passwordHash` is absent from response
- **Missing token** → 401
- **Invalid/malformed token** → 401
- **Expired token** → 401

---

## Acceptance Criteria

- [ ] `npm install` completes with zero Clerk packages in the lockfile
- [ ] No file in the repo imports from `@clerk/express` or `@clerk/clerk-react`
- [ ] `POST /api/auth/register` creates a user and returns a JWT and safe user fields
- [ ] `POST /api/auth/login` returns a JWT for valid credentials; 401 for invalid
- [ ] `GET /api/auth/me` returns safe user fields for a valid token; 401 for missing/invalid/expired token
- [ ] On app load, `AuthContext` calls `/api/auth/me` (not client-side token decode) to hydrate user state
- [ ] On app load with no stored token, `isLoaded` is set to true without a network request
- [ ] `POST /api/scores` returns 401 with no token, 401 with expired token, 200 with valid token
- [ ] `POST /api/scores` returns 404 if authenticated user does not exist in the database (no upsert)
- [ ] `GET /api/leaderboard` returns top 20 without `passwordHash`, `email`, or `_id` exposed
- [ ] Registering with a duplicate email returns 409 `{ error: "email_taken" }`
- [ ] Registering with a duplicate username returns 409 `{ error: "username_taken" }`
- [ ] Registering with username `"LAURA"` and then registering with `"laura"` returns 409 (case-insensitive uniqueness)
- [ ] Registering without a username succeeds; a second user with no username also succeeds (sparse unique index)
- [ ] Password min-length of 8 is enforced; shorter password returns 400
- [ ] `/game` redirects unauthenticated visitors to `/login`
- [ ] `/game` shows a loading state while `isLoaded` is false
- [ ] After login, token is stored in `localStorage` under `luna_token` and user can play and submit scores
- [ ] Logout clears `luna_token` from `localStorage`, resets auth context, and redirects to `/home`; no backend request is made
- [ ] Header shows Login/Register when logged out; displayName + Logout when logged in
- [ ] All existing `scores.test.js` assertions pass with the new auth mock
- [ ] New `GET /api/auth/me` tests pass (valid token, missing, invalid, expired)
- [ ] `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` are absent from all `.env` files
- [ ] `JWT_SECRET` is present in root `.env` and documented in `CLAUDE.md`
- [ ] `/post-signup` route no longer exists; navigating to it 404s or redirects

---

## Open Questions

- None at this stage.

---

## Assumptions

- No production user data needs migrating — dropping and re-creating the `users` collection in dev/staging is acceptable.
- The `imageUrl` / avatar feature (currently sourced from Clerk) is dropped; no avatar UI is added as a replacement.
- `firstName` / `lastName` separate fields are dropped in favour of a single `fullName` field; `displayName` continues to be derived from `fullName` and is what appears publicly.
- Password reset and email verification are out of scope for this migration.
- The Heroku backend deployment does not need changes beyond updating env vars (`JWT_SECRET` replaces the Clerk keys).
- The Namecheap frontend deployment (via GitHub Actions FTP) does not need changes; `VITE_CLERK_PUBLISHABLE_KEY` is simply removed from the build env.
- Backend logout endpoint is intentionally out of scope for v1. Client-side token removal is sufficient.
