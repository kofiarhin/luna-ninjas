// server/middleware/clerkAuth.js
// Verifies the Clerk JWT from the Authorization header.
// Attaches req.auth = { userId } where userId is the verified clerkUserId (sub claim).
// Returns 401 if token is missing, invalid, or expired.

const { clerkMiddleware, getAuth } = require("@clerk/express");

if (!process.env.CLERK_SECRET_KEY) {
  console.error(
    "\n⚠️  CLERK_SECRET_KEY is not set in .env — score submission will fail with 401.\n" +
      "   Get it from: Clerk Dashboard → Configure → API Keys → Secret keys\n"
  );
}

// Build the standard Clerk middleware once (reads CLERK_SECRET_KEY from env)
const _clerkMiddleware = clerkMiddleware();

const clerkAuth = (req, res, next) => {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error("clerkAuth: CLERK_SECRET_KEY is missing — rejecting request");
    return res.status(401).json({ message: "Server auth not configured" });
  }

  // Run the Clerk middleware to populate req.auth via the SDK
  _clerkMiddleware(req, res, (err) => {
    if (err) {
      console.error("clerkAuth: middleware error:", err.message || err);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      console.error("clerkAuth: no userId in token. auth:", JSON.stringify(auth));
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Normalise: expose userId at req.auth.userId
    req.auth = { userId: auth.userId };
    return next();
  });
};

module.exports = clerkAuth;
