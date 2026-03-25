const User = require("../models/user.model");

const registerUser = async (req, res, next) => {
  try {
    const { clerkUserId, email, firstName, lastName, imageUrl } = req.body;
    if (!clerkUserId) return res.status(401).json({ message: "Unauthorized" });

    // Compute displayName with priority:
    // 1. fullName (firstName + lastName combined) if non-empty
    // 2. firstName alone if present
    // 3. "Anonymous Ninja" fallback
    const fullName = `${firstName || ""} ${lastName || ""}`.trim();
    let displayName;
    if (fullName) {
      displayName = fullName;
    } else if (firstName) {
      displayName = firstName;
    } else {
      displayName = "Anonymous Ninja";
    }

    // create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      clerkUserId,
      imageUrl,
      displayName,
    });

    return res.json(user);
  } catch (err) {
    // duplicate clerkUserId (unique index)
    if (err?.code === 11000) {
      return res.status(409).json({ message: "User already registered" });
    }
    return next(err);
  }
};

module.exports = { registerUser };
