const { Router } = require("express");
const { registerUser } = require("../controllers/authController");

const router = Router();

router.post("/register", registerUser);
module.exports = router;
