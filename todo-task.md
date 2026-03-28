# TODO Task — Persistent Profile Image Upload (Heroku + Cloudinary)

## Goal
Make “change profile image” persist correctly in production.

## Why
Heroku dynos use an ephemeral filesystem, so saving uploaded images to a local `uploads/` folder will not persist across restarts/redeploys.

## Decision
Use **Cloudinary** for image storage instead of local server disk.

## Expected Result
- User can upload a new profile image
- Backend uploads the image to Cloudinary
- MongoDB stores the image URL and Cloudinary public ID on the user record
- Frontend reads the saved URL from the database
- Profile image persists after refresh, logout/login, redeploy, and dyno restart

## Backend Tasks
- Install and configure:
  - `cloudinary`
  - `multer`
  - optional: `streamifier` if using memory uploads
- Add Cloudinary environment variables to `.env`
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Create Cloudinary config module
- Create/update upload middleware for profile image uploads
- Restrict uploads to image file types only
- Add file size limit
- Create/update API route for changing profile image
- In controller:
  - accept uploaded file
  - upload file to Cloudinary
  - save returned `secure_url` and `public_id` to the user document
  - if user already has a profile image, optionally delete old Cloudinary asset using previous `public_id`
  - return updated user payload
- Ensure auth protection exists on the profile image update route
- Handle upload errors cleanly
- Validate missing file / invalid mime type cases

## Database Tasks
- Update user schema to include fields like:
  - `profileImageUrl`
  - `profileImagePublicId`
- Ensure old users without these fields still work

## Frontend Tasks
- Update profile image change flow to use real file upload
- Send image as `multipart/form-data`
- Call the authenticated profile-image update endpoint
- Update UI with returned saved image URL
- Persist updated user/auth state after successful upload
- Show loading state during upload
- Show error state on failure
- Prevent invalid file submission
- Keep default avatar fallback when no profile image exists

## Replace Image Behavior
- When user uploads a new image:
  - upload new image to Cloudinary
  - update DB with new URL/public ID
  - delete previous Cloudinary image if one exists

## Error Handling
- Invalid file type
- File too large
- Missing file
- Cloudinary upload failure
- Unauthorized request
- DB update failure
- Cloudinary delete failure should not break the main upload if the new upload already succeeded

## Security / Validation
- Auth required
- Image-only uploads
- Size limit enforced
- Do not trust frontend mime checks alone
- Validate on server

## UX Notes
- Show preview before upload if desired
- Show spinner/progress state while uploading
- Show success confirmation after save
- Display saved profile image everywhere user avatar is used

## Out of Scope
- Local `uploads/` folder storage in production
- S3 / other storage providers
- Image cropping UI
- Multiple avatars/gallery support

## Notes
- Local disk uploads are okay for local development only
- For Heroku production, Cloudinary is the correct persistence path
