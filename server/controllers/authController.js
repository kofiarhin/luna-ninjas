// server/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const signToken = (userId) =>
  jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Only safe fields returned to the client — never passwordHash
const safeUser = (user) => ({
  _id: user._id,
  displayName: user.displayName,
  email: user.email,
  username: user.username,
  fullName: user.fullName,
  profileImage: user.profileImage,
});

/**
 * POST /api/auth/register
 * Public. Creates a new user and returns a JWT.
 */
const registerUser = async (req, res, next) => {
  try {
    let { fullName, email, password } = req.body;

    // Validate required fields
    const errors = {};
    if (!fullName || !fullName.trim())
      errors.fullName = "Full name is required";
    if (!email || !email.trim()) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";
    else if (password.length < 8)
      errors.password = "Password must be at least 8 characters";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    fullName = fullName.trim();
    email = email.trim().toLowerCase();

    // Uniqueness checks
    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(409).json({ error: "email_taken" });

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = fullName;

    const user = await User.create({
      fullName,
      email,
      passwordHash,
      displayName,
    });

    const token = signToken(user._id);
    return res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/login
 * Public. Verifies credentials and returns a JWT.
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ errors: { email: "Email and password are required" } });
    }

    // Select passwordHash explicitly (field has select:false in schema)
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "invalid_credentials" });

    const token = signToken(user._id);
    return res.json({ token, user: safeUser(user) });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/auth/me
 * Protected (authMiddleware). Returns the current authenticated user.
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId).select(
      "_id displayName email username totalScore gamesPlayed fullName profileImage",
    );
    if (!user) return res.status(404).json({ error: "user_not_found" });
    return res.json(user);
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/auth/profile
 * Protected (authMiddleware). Updates the current authenticated user's profile.
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { fullName, username, displayName, profileImage } = req.body;

    // Validate
    const errors = {};
    if (fullName !== undefined && (!fullName || !fullName.trim())) {
      errors.fullName = "Full name is required";
    }
    if (username !== undefined) {
      const normalizedUsername = username.trim().toLowerCase();
      if (normalizedUsername && !/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
        errors.username =
          "Username must be 3–30 characters: letters, numbers, and underscores only";
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Prepare update object
    const update = {};
    if (fullName !== undefined) update.fullName = fullName.trim();
    // displayName is deprecated from active identity flow, but we still accept
    // updates for backward compatibility.
    if (displayName !== undefined) update.displayName = displayName.trim();
    if (profileImage !== undefined) update.profileImage = profileImage;
    if (username !== undefined) {
      update.username =
        username && username.trim() ? username.trim().toLowerCase() : undefined;
    }

    // Check username uniqueness if changing
    if (update.username !== undefined) {
      const existing = await User.findOne({
        username: update.username,
        _id: { $ne: userId },
      });
      if (existing) {
        return res.status(409).json({ error: "username_taken" });
      }
    }

    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!user) return res.status(404).json({ error: "user_not_found" });

    return res.json(safeUser(user));
  } catch (err) {
    next(err);
  }
};

module.exports = { registerUser, loginUser, getMe, updateProfile };
