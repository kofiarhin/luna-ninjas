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

## Problem

Clerk is a third-party auth service that controls identity, session management, and UI. Removing it eliminates the external dependency, removes per-MAU billing risk, and gives the team full control over the auth schema (adding `username`, `password`, etc.).

## Users / Actors

- **Visitor** — not logged in; can view home and leaderboard
- **Registered user** — logged in; can play the game and submit scores

---

## Core Requirements

1. Users can register with `fullName`, `email`, `password`, and an optional `username`.
2. If `username` is provided it must be unique across all users.
3. `email` must be unique across all users.
4. Passwords are hashed with bcrypt before storage; plain-text passwords are never stored or logged.
5. Login accepts `email` + `password` and returns a signed JWT.
6. The JWT payload contains the MongoDB `_id` (used everywhere Clerk's `userId` was used).
7. JWTs expire after 7 days. No refresh-token flow is required.
8. A custom Express middleware `authMiddleware` verifies the Bearer token and sets `req.auth.userId` to the MongoDB `_id` string — the same shape the existing controllers already consume.
9. `POST /api/scores` remains protected by this middleware; no other endpoints change their auth posture.
10. `POST /api/auth/register` and `POST /api/auth/login` are public.
11. `GET /api/leaderboard` remains public.
12. The `/post-signup` route and `PostSignUp` component are removed; registration now happens in a single request.
13. Frontend stores the JWT in `localStorage` under the key `luna_token`.
14. A React `AuthContext` replaces `ClerkProvider`; it exposes `{ user, token, login, logout, isLoaded }`.
15. `useSubmitScore` reads the token from context instead of calling Clerk's `getToken()`.
16. Protected route `/game` redirects to `/login` if `AuthContext.user` is null after loading.
17. The header shows user controls (display name + logout button) when authenticated, or Login/Register links when not.
18. `@clerk/express` and `@clerk/clerk-react` are removed from both `package.json` files.
19. `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY` are removed from all `.env` files; `JWT_SECRET` is added.
20. The test suite is updated: `clerkAuth` mock is replaced with a custom-token injection pattern; all existing test cases still pass.

---

## User Flows

### Register
1. User navigates to `/register`.
2. Fills in: Full Name (required), Email (required), Password (required), Username (optional).
3. Submits → `POST /api/auth/register`.
4. On success: backend returns `{ token, user }`. Frontend stores token, sets context, redirects to `/game`.
5. On failure: inline validation messages (duplicate email, duplicate username, missing fields).

### Login
1. User navigates to `/login`.
2. Fills in: Email + Password.
3. Submits → `POST /api/auth/login`.
4. On success: backend returns `{ token, user }`. Frontend stores token, sets context, redirects to `/game`.
5. On failure: "Invalid email or password" (single message — no field-level hints for security).

### Play game & submit score
1. `/game` checks `AuthContext.user`; if null after `isLoaded`, redirects to `/login`.
2. After a round, `useSubmitScore` reads `token` from context, sends `Authorization: Bearer <token>`.
3. `authMiddleware` verifies token, sets `req.auth.userId` to MongoDB `_id`.
4. `scoreController` queries `User.findById(userId)` — same atomic upsert, no other changes needed.

### Logout
1. User clicks logout button in header.
2. `AuthContext.logout()` clears `localStorage` and resets context.
3. User is redirected to `/home`.

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
Actions: login(token, user), logout()
Init: on mount, read luna_token from localStorage, decode payload, set user
Expose via useAuth() hook exported from same file
```

### Routing / Navigation

Changes to `App.jsx`:
- Remove `ClerkProvider`, `SignedIn`, `SignedOut` imports
- Wrap app in `<AuthProvider>` instead of `<ClerkProvider>`
- Replace `<SignedIn>/<SignedOut>` guards with a `<PrivateRoute>` component that reads from `AuthContext`
- Remove `/post-signup` route
- Keep `/login/*` and `/register/*` paths but render custom components (not Clerk's)

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
  "username": "laura"        // optional
}
```
Logic:
1. Validate required fields; return 400 with field errors if missing.
2. Check email uniqueness → 409 `{ error: "email_taken" }`.
3. If username provided, check uniqueness → 409 `{ error: "username_taken" }`.
4. Hash password with `bcrypt.hash(password, 10)`.
5. Derive `displayName` from `fullName` (trim) — no more firstName/lastName split needed.
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

#### `POST /api/scores` — unchanged contract, only middleware swapped
- Remove `clerkAuth` import, add `authMiddleware` import in `scoreRoutes.js`
- `scoreController.js` already uses `req.auth.userId` — no changes needed there
- Change `User.findOne({ clerkUserId: userId })` → `User.findById(userId)`
- Change upsert `$setOnInsert` to use `_id: userId` (or use `findByIdAndUpdate`)

#### `GET /api/leaderboard` — no changes

### Validation

| Field | Rule |
|---|---|
| fullName | Required, non-empty string, max 100 chars |
| email | Required, valid email format, unique |
| password | Required, min 8 chars |
| username | Optional; if provided: alphanumeric + underscores, 3–30 chars, unique |

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
| `username` | **Add** — String, optional, unique sparse index |
| `email` | Keep, add unique index |
| `displayName` | Keep — set from `fullName` at registration |
| `totalScore` | Keep |
| `gamesPlayed` | Keep |

> **Note:** If the database already has documents with the old schema, a migration script or `dropDatabase` in dev is needed. Since this is an early-stage app with no production user data to preserve, dropping and re-creating the collection in dev is acceptable.

### Package Cleanup

**Root `package.json`:**
- Remove `@clerk/express`
- Add `bcryptjs` (or `bcrypt`) and `jsonwebtoken`

**`client/package.json`:**
- Remove `@clerk/clerk-react`
- No new packages required (context API is built-in)

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

## States and Edge Cases

| Scenario | Behavior |
|---|---|
| Token expired (7d) | `authMiddleware` returns 401; frontend `useSubmitScore` returns `{ error: "Session expired — please log in again" }` and clears stored token |
| Username field left blank | Stored as `undefined`, not empty string; unique sparse index allows multiple nulls |
| Username submitted as empty string | Treat as omitted (strip before save) |
| Email already registered | 409 `{ error: "email_taken" }` |
| Username already taken | 409 `{ error: "username_taken" }` |
| Wrong password | 401 `{ error: "invalid_credentials" }` — same message as "user not found" to prevent email enumeration |
| Score submitted before `isLoaded` | `useSubmitScore` early-returns; no request sent |
| `JWT_SECRET` missing from env | Server warns on startup and will throw at runtime on first sign/verify — same pattern as existing `CLERK_SECRET_KEY` warning |
| User navigates to `/game` while not logged in | `PrivateRoute` redirects to `/login` |
| User navigates to `/login` while already logged in | Redirect to `/game` |

---

## Technical Notes

- `jsonwebtoken` is already a common dep in Express apps; add to root package.
- `bcryptjs` is the pure-JS version and avoids native build issues on Windows — prefer it over `bcrypt`.
- The JWT payload only needs `{ _id }`. Do not include email, username, or roles in the token — fetch from DB when needed.
- `scoreController.js` queries the user by `clerkUserId` today. Change to `User.findById(req.auth.userId)`. The atomic upsert also needs updating — change `clerkUserId` key to `_id` or switch to `findByIdAndUpdate` with upsert.
- `useLeaderboard.js` has no Clerk dependency — no changes needed.
- `questionRoutes.js` / `questionController.js` — check for Clerk imports (audit shows none, but confirm before closing the task).
- `AuthContext` should handle the case where the stored JWT is malformed (try/catch around `atob` or `jwt-decode`).
- CLAUDE.md must be updated: remove Clerk gotcha note, update env section, update auth middleware description.

---

## Acceptance Criteria

- [ ] `npm install` completes with zero Clerk packages in the lockfile
- [ ] No file in the repo imports from `@clerk/express` or `@clerk/clerk-react`
- [ ] `POST /api/auth/register` creates a user and returns a JWT
- [ ] `POST /api/auth/login` returns a JWT for valid credentials; 401 for invalid
- [ ] `POST /api/scores` returns 401 with no token, 401 with expired token, 200 with valid token
- [ ] `GET /api/leaderboard` returns top 20 without `passwordHash`, `email`, or `_id` exposed
- [ ] Registering with a duplicate email returns 409 `{ error: "email_taken" }`
- [ ] Registering with a duplicate username returns 409 `{ error: "username_taken" }`
- [ ] Registering without a username succeeds; a second user with no username also succeeds (sparse unique index)
- [ ] Password min-length of 8 is enforced; shorter password returns 400
- [ ] `/game` redirects unauthenticated visitors to `/login`
- [ ] After login, token is stored in `localStorage` and user can play and submit scores
- [ ] Logout clears the token from `localStorage` and redirects to `/home`
- [ ] Header shows Login/Register when logged out; displayName + Logout when logged in
- [ ] All existing `scores.test.js` assertions pass with the new auth mock
- [ ] `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` are absent from all `.env` files
- [ ] `JWT_SECRET` is documented in CLAUDE.md
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
