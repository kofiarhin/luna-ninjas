const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { recordInsights, getInsights } = require("../controllers/insightController");

router.post("/record", authMiddleware, recordInsights);
router.get("/", authMiddleware, getInsights);

module.exports = router;
