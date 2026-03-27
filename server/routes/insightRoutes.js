const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  recordInsights,
  getInsights,
  getSmartRoundPlan,
} = require("../controllers/insightController");

router.post("/record", authMiddleware, recordInsights);
router.get("/", authMiddleware, getInsights);
router.get("/smart-round", authMiddleware, getSmartRoundPlan);

module.exports = router;
