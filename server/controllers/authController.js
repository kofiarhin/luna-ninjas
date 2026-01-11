const User = require("../models/user.model");

const registerUser = async (req, res, next) => {
  try {
    const { clerkUserId, email, firstName, lastName, imageUrl } = req.body;
    if (!clerkUserId) return res.status(401).json({ message: "Unauthorized" });

    // create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      clerkUserId,
      imageUrl,
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
