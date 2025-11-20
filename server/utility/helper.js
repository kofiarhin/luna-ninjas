// server/utility/helper.js

const Groq = require("groq-sdk");
const { systemPrompt } = require("./systemPrompts");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Generate a set of adaptive multiplication questions for a session.
 *
 * @param {Array<Object>} history - Past questions & answers for this user.
 *   Example item:
 *   {
 *     a: 2,
 *     b: 3,
 *     correctAnswer: 6,
 *     userAnswer: 4,
 *     isCorrect: false
 *   }
 * @param {number} sessionSize - Number of questions to generate (default 20).
 * @returns {Promise<Array<Object>>} questions
 */
const generateMultiplicationQuestions = async (
  history = [],
  sessionSize = 20
) => {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // ✅ updated from deprecated llama3-70b-8192
      temperature: 0.4,
      max_completion_tokens: 1200,
      response_format: { type: "json_object" }, // ask Groq to return JSON only
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify({
            history,
            sessionSize,
          }),
        },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("Groq returned empty content for multiplication questions");
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error(
        "Failed to parse Groq JSON for multiplication questions:",
        err,
        content
      );
      return [];
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error(
        'Groq JSON did not contain a valid "questions" array:',
        parsed
      );
      return [];
    }

    // Normalize: ensure we never exceed sessionSize
    const questions = parsed.questions.slice(0, sessionSize);

    return questions;
  } catch (err) {
    console.error("Groq generation error:", err);
    return [];
  }
};

module.exports = {
  generateMultiplicationQuestions,
};
