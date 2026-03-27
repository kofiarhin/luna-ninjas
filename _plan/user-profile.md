# User Profile

## Summary

Add a protected User Profile page where the authenticated user can view their profile details, edit their name/username/display name, upload or change a profile image via Cloudinary, and save updates that immediately reflect across the app (header, auth state). This builds on the existing custom JWT auth system, `AuthContext`, and the Cloudinary upload helper already in the repo.

## Goal

An authenticated user can view, edit, and save their profile — including a profile image — from a dedicated `/profile` route, and see the updated data reflected in the header and auth context immediately after saving.

## Non-Goals

- Admin profile management
- Password reset or change flow
- Social auth
- Deleting account
- Changing email address
- Multi-image gallery or media library
- Public profile pages (other users viewing your profile)

## Problem

There is no way for users to view or update their profile after registration. The header shows `displayName` but users cannot change it, upload an avatar, or correct their username. The user schema has no `profileImage` field, and there is no backend endpoint for updating profile data.

## Users / Actors

- **Authenticated user** — the only actor. Must be logged in with a valid JWT.

## Core Requirements

1. New protected frontend route: `/profile`
2. Profile page displays current user data: fullName, email (read-only), username, displayName, profileImage
3. User can edit: fullName, username, displayName, profileImage
4. Email is displayed but **not editable**
5. Profile image upload uses the existing `uploadService.js` Cloudinary helper
6. Image preview shown before saving (after upload completes or after file selection with local preview)
7. On save, a single `PATCH /api/auth/profile` call sends all changed fields (including the new image URL if uploaded)
8. On successful save, `AuthContext.user` is updated in-place so the header and rest of the app reflect changes immediately — no page reload
9. Username validation rules match the register flow: `^[a-z0-9_]{3,30}$`, blank treated as omitted
10. Backend returns 409 with `{ error: "username_taken" }` if the new username collides with another user
11. Backend validates fullName is non-empty and trims whitespace, same as register
12. User schema gains a new `profileImage` field (String, default `""`)
13. `safeUser()` in `authController.js` and `getMe` select list must include `fullName` and `profileImage`
14. `GET /api/auth/me` response shape expands to include `fullName` and `profileImage` so the frontend can hydrate the profile page without a separate endpoint

## User Flows

### View profile
1. User clicks their display name or a "Profile" link in the header nav
2. App navigates to `/profile` (protected by `PrivateRoute`)
3. Profile page mounts → reads `user` from `AuthContext` for initial render
4. Page displays: profile image (or placeholder), fullName, email (greyed/read-only), username, displayName, totalScore, gamesPlayed (stats section, read-only)

### Edit profile
1. User modifies any editable field (fullName, username, displayName)
2. Fields validate inline on blur: fullName must be non-empty, username must match `^[a-z0-9_]{3,30}$` or be blank
3. User clicks "Save changes"
4. Button enters loading/disabled state
5. `PATCH /api/auth/profile` is called with `{ fullName, username, displayName, profileImage }` — only changed fields need to be sent, but sending all is acceptable
6. On success: backend returns updated safe user object → frontend calls a new `updateUser(userData)` on AuthContext → header and page re-render with new data
7. On 409 (username_taken): field error shown on username
8. On 400 (validation errors): field errors shown inline
9. On network/server error: generic error banner shown
10. On success: brief success feedback (toast or inline "Profile updated" message)

### Upload profile image
1. User clicks on the profile image area (or an "Upload" / "Change photo" button)
2. File picker opens — accepts image types only (`image/png, image/jpeg, image/webp`)
3. After file selection, show a local preview immediately using `URL.createObjectURL`
4. On form submit (or immediately on selection — either is acceptable, but on-submit is preferred to batch with other changes):
   a. Call `uploadImage(file, "luna-ninjas/avatars")` from `uploadService.js`
   b. Show upload progress state on the image area (spinner or opacity)
   c. On success: store returned `secure_url` in form state as `profileImage`
   d. On failure: show error, revert preview to previous image
5. The `profileImage` URL is sent along with other fields in the `PATCH` call

## Functional Details

### Database / Schema

**File:** `server/models/user.model.js`

Add field to `userSchema`:
```
profileImage: { type: String, default: "" }
```

No index needed. No migration needed — Mongoose handles missing fields gracefully with the default.

### Backend API

**New endpoint:** `PATCH /api/auth/profile`
- **Auth:** requires `authMiddleware`
- **Mount:** add to `server/routes/authRoutes.js` as `router.patch("/profile", authMiddleware, updateProfile)`
- **Controller:** new `updateProfile` function in `server/controllers/authController.js`

Request body (all optional, but at least one required):
```json
{
  "fullName": "Jane Doe",
  "username": "ninja42",
  "displayName": "Jane",
  "profileImage": "https://res.cloudinary.com/dlsiabgiw/image/upload/v.../avatar.jpg"
}
```

Behavior:
1. Extract `req.auth.userId`
2. Validate:
   - If `fullName` is present, must be non-empty after trim
   - If `username` is present and non-empty, must match `^[a-z0-9_]{3,30}$` after trim+lowercase. If empty string, set to `undefined` (remove username)
   - If `profileImage` is present, must be a string (URL). No server-side URL validation needed — the frontend controls Cloudinary upload
   - `displayName` is free text, trim only
3. If `username` changed and is non-empty, check uniqueness: `User.findOne({ username, _id: { $ne: userId } })`
   - If taken: return 409 `{ error: "username_taken" }`
4. Build update object from validated fields only
5. `User.findByIdAndUpdate(userId, update, { new: true }).select("-passwordHash")`
6. If user not found: 404 `{ error: "user_not_found" }`
7. Return updated user through `safeUser()` — which must now include `fullName` and `profileImage`

**Existing endpoint changes:**

`safeUser()` currently returns: `_id, displayName, email, username`
Must expand to: `_id, displayName, email, username, fullName, profileImage`

`getMe` currently selects: `_id displayName email username totalScore gamesPlayed`
Must expand to: `_id displayName email username totalScore gamesPlayed fullName profileImage`

**Important:** `registerUser` and `loginUser` both call `safeUser()`, so after this change the login/register responses will also include `fullName` and `profileImage`. This is desirable — no breaking change.

### Frontend — AuthContext

**File:** `client/src/context/AuthContext.jsx`

Add a new `updateUser` function:
```
const updateUser = (updatedFields) => {
  setUser((prev) => ({ ...prev, ...updatedFields }));
};
```

Expose `updateUser` in the provider value alongside `user, token, login, logout, isLoaded`.

This allows the profile page to merge updated fields without re-fetching `/me` or replacing the full user object.

### Frontend — Routing

**File:** `client/src/App.jsx`

Add:
```
import Profile from "./Pages/Profile/Profile";
```

Add route inside `<Routes>`:
```
<Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
```

### Frontend — Header

**File:** `client/src/components/Header/Header.jsx`

Change the `header-display-name` span to a `NavLink` to `/profile`:
- Text: `user.displayName` (unchanged)
- If `user.profileImage` exists, show a small avatar `<img>` (24–28px circle) next to the display name
- On mobile, hide display name text, show only the avatar (or a generic user icon if no image)

### Frontend — Profile Page

**New files:**
- `client/src/Pages/Profile/Profile.jsx`
- `client/src/Pages/Profile/profile.styles.scss`

**Layout:** Uses the same `AuthLayout` wrapper or a similar centered card layout (max-width ~520px). Reuse the auth card design system from `auth-layout.styles.scss` for visual consistency.

**Sections:**

1. **Avatar area** (top of card)
   - Circular image (96–120px) showing `user.profileImage` or a placeholder (initials or generic icon)
   - Overlay or adjacent "Change photo" button
   - Hidden `<input type="file" accept="image/png,image/jpeg,image/webp">` triggered by button click
   - After file selection: local preview via `URL.createObjectURL`, upload state indicator

2. **Stats bar** (read-only)
   - `totalScore` and `gamesPlayed` displayed as small stat cards or inline badges
   - Not editable — informational only

3. **Form fields**
   - Full name — text input, required
   - Email — text input, `disabled` / `readOnly`, visually muted
   - Username — text input, optional, hint text shows format rules
   - Display name — text input, optional

4. **Actions**
   - "Save changes" button — primary style (matches auth CTA)
   - Disabled when: loading, no changes made, or upload in progress
   - "Cancel" or "Reset" — optional, resets form to last saved state

5. **Feedback**
   - Success: inline "Profile updated" text or brief toast, auto-dismisses after 3s
   - Errors: field-level errors inline + API error banner at top (same pattern as register page)

### Frontend — Custom Hook

**New file:** `client/src/hooks/useUpdateProfile.js`

Encapsulates the `PATCH /api/auth/profile` call:
- Reads `token` from `useAuth()`
- Accepts an object of fields to update
- Returns `{ update, loading, error, fieldErrors }`
- On success, calls `updateUser()` from context
- Follows same pattern as existing `useSubmitScore.js`

### Validation Rules

| Field | Rule | Error message |
|-------|------|---------------|
| fullName | Non-empty after trim | "Full name is required" |
| username | `^[a-z0-9_]{3,30}$` or empty | "Username must be 3–30 characters: letters, numbers, and underscores only" |
| username | Unique (server) | "This username is already taken" |
| displayName | No constraint (trim only) | — |
| profileImage | Must be valid Cloudinary URL (client controls this) | — |

Client-side validation runs on blur for immediate feedback. Server re-validates authoritatively.

## States and Edge Cases

| State | Behavior |
|-------|----------|
| **Loading (initial)** | Show skeleton/spinner while `isLoaded` is false on `AuthContext`. Once loaded, populate form from `user` object. |
| **Unauthenticated** | `PrivateRoute` redirects to `/login`. Profile page never renders. |
| **No changes made** | "Save changes" button stays disabled. |
| **Upload in progress** | Save button disabled. Spinner on avatar area. |
| **Upload failure** | Error message near avatar. Revert preview. Save button re-enabled (submits without image change). |
| **Cloudinary env var missing** | `VITE_UPLOAD_PRESET` not set → `uploadImage` will fail. Show generic upload error. |
| **Duplicate submit** | Button disabled during `loading` state. No double requests. |
| **409 username_taken** | Show inline field error on username input (same as register). |
| **400 validation errors** | Show inline field errors, same pattern as register page `fieldErrors`. |
| **Network error** | Show generic error banner at top of form. |
| **Token expired mid-edit** | PATCH returns 401 → clear auth state → redirect to login (existing AuthContext behavior handles this if the user navigates; for inline failure, show "Session expired, please log in again"). |
| **Very long displayName** | No max enforced currently. Consider a soft 50-char limit client-side if desired, but not required for MVP. |
| **Large image file** | Cloudinary free tier has a 10MB limit. The `uploadImage` helper will throw on failure. Show "Upload failed" error. Optionally validate file size client-side before upload (e.g., reject > 5MB). |
| **Image format not accepted** | `accept` attribute on file input restricts to png/jpeg/webp. If bypassed, Cloudinary handles rejection. |

## Technical Notes

1. **No new route file needed on the backend.** The `PATCH /profile` endpoint belongs on `authRoutes.js` since it's auth-scoped and operates on the current user — consistent with `GET /me` living there.

2. **`safeUser()` expansion is a cross-cutting change.** After adding `fullName` and `profileImage` to `safeUser()`, the login and register responses will also return these fields. This is intentional and non-breaking — the frontend currently ignores extra fields.

3. **AuthContext `updateUser` must be a shallow merge**, not a full replacement, so that fields like `totalScore` and `gamesPlayed` (which come from `/me` but not from the profile PATCH response) are preserved.

4. **The Cloudinary upload is unsigned** (uses `upload_preset` from env). This is the existing pattern in `uploadService.js`. No backend proxy is needed.

5. **`VITE_UPLOAD_PRESET` is required** in the client `.env` for image upload to work. The feature should degrade gracefully if missing — the upload button can be hidden or disabled, and the rest of the profile form still works.

6. **Existing pattern inconsistency:** `safeUser()` returns `_id` but `getMe()` uses an explicit `.select()` string that also returns `_id`. After this change, both should return the same shape. Consider having `getMe` call `safeUser()` instead of a manual `.select()` to keep them in sync — but this is a minor refactor, not blocking.

7. **No new env vars needed** beyond the already-expected `VITE_UPLOAD_PRESET` (which the upload service already depends on).

8. **Header avatar:** If `profileImage` is empty/falsy, show a fallback — either the user's initials in a colored circle or a generic user SVG icon. Do not show a broken `<img>` tag.

## File Impact

### Files Confirmed To Exist (To Update)

| File | Change |
|------|--------|
| `server/models/user.model.js` | Add `profileImage` field |
| `server/controllers/authController.js` | Expand `safeUser()`, expand `getMe` select, add `updateProfile` controller |
| `server/routes/authRoutes.js` | Add `PATCH /profile` route |
| `client/src/context/AuthContext.jsx` | Add `updateUser` function, expose in provider |
| `client/src/App.jsx` | Add `/profile` route with `PrivateRoute` |
| `client/src/components/Header/Header.jsx` | Link display name to `/profile`, show avatar |
| `client/src/components/Header/header.styles.scss` | Avatar styles, profile link styles |

### Files To Create

| File | Purpose |
|------|---------|
| `client/src/Pages/Profile/Profile.jsx` | Profile page component |
| `client/src/Pages/Profile/profile.styles.scss` | Profile page styles |
| `client/src/hooks/useUpdateProfile.js` | Hook for PATCH /api/auth/profile |

### Files Not Changed

| File | Reason |
|------|--------|
| `server/middleware/authMiddleware.js` | No changes — reused as-is |
| `server/app.js` | No changes — auth routes already mounted |
| `client/src/components/Upload/uploadService.js` | No changes — reused as-is |
| `client/src/constants/constans.js` | No changes — `BASE_URL` already available |

## Acceptance Criteria

- [ ] `GET /api/auth/me` returns `fullName` and `profileImage` in the response
- [ ] `PATCH /api/auth/profile` accepts `fullName`, `username`, `displayName`, `profileImage` and updates the user document
- [ ] `PATCH /api/auth/profile` returns 401 without a valid JWT
- [ ] `PATCH /api/auth/profile` returns 409 when username is taken by another user
- [ ] `PATCH /api/auth/profile` validates fullName is non-empty and username matches format rules
- [ ] User schema has `profileImage` field with default `""`
- [ ] `/profile` route exists, is protected by `PrivateRoute`, and redirects to `/login` when unauthenticated
- [ ] Profile page displays all current user fields on mount
- [ ] Email field is visible but not editable
- [ ] Editing fullName, username, or displayName and saving persists changes to the database
- [ ] After save, header display name updates without page reload
- [ ] Clicking "Change photo" opens file picker restricted to image types
- [ ] Selected image shows local preview before save
- [ ] Image uploads to Cloudinary via existing `uploadService.js`
- [ ] Uploaded image URL is saved to `profileImage` field on the user document
- [ ] After save, avatar in header updates to new image
- [ ] Save button is disabled when no changes have been made
- [ ] Save button is disabled during loading/upload
- [ ] Username field shows inline error on 409 response
- [ ] Validation errors display inline on the respective fields
- [ ] Network/server errors display as a banner at the top of the form
- [ ] Profile page is responsive on mobile, tablet, and desktop
- [ ] All interactive elements have visible focus styles

## Open Questions

- None at this stage.

## Assumptions

- `VITE_UPLOAD_PRESET` env var is already configured for the existing upload functionality. If not, it must be added for image upload to work.
- The Cloudinary account (`dlsiabgiw`) has sufficient capacity for avatar uploads.
- No file size or dimension constraints are enforced server-side — Cloudinary's defaults apply.
- `displayName` defaults to `fullName` at registration (current behavior). The profile page allows them to diverge.
