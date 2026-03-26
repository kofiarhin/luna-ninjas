// server/middleware/authMiddleware.js
// Verifies the custom JWT from the Authorization header.
// Attaches req.auth = { userId } where userId is the MongoDB _id from the token payload.
// Returns 401 if token is missing, invalid, or expired.

const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  console.error(
    "\n⚠️  JWT_SECRET is not set in .env — authenticated endpoints will fail with 401.\n" +
      "   Add JWT_SECRET=<random-64-char-string> to your root .env file.\n"
  );
}

const authMiddleware = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    console.error("authMiddleware: JWT_SECRET is missing — rejecting request");
    return res.status(401).json({ message: "Server auth not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = { userId: decoded._id };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = authMiddleware;
