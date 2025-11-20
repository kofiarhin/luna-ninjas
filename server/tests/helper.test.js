require("dotenv").config();
const { generateMultiplicationQuestions } = require("../utility/helper");

describe("passing test", () => {
  it("should return list of question", async () => {
    const response = await generateMultiplicationQuestions();
    expect(response.length).toBeGreaterThan(0);
  });

  it("should query for questions properly", async () => {});
});
