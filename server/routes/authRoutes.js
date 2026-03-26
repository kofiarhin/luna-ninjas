const { Router } = require("express");
const { registerUser, loginUser, getMe } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getMe);

module.exports = router;
