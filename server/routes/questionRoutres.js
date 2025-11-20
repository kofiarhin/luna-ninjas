const { Router } = require("express");
const { generateMultiplicationQuestions } = require("../utility/helper");

const router = Router();

router.post("/", async (req, res, next) => {
  const { history } = req.body;

  const questions = await generateMultiplicationQuestions(history);
  return res.json(questions);
});

module.exports = router;
