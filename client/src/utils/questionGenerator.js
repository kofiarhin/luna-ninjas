// client/src/utils/questionGenerator.js
// Generates a fresh round of 12 multiplication questions for a given table.

/**
 * Fisher-Yates in-place shuffle.
 * @param {Array} arr
 * @returns {Array} the same array, shuffled
 */
const fisherYates = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Generate 3 wrong answer candidates for a question.
 * Strategy:
 *   1. Build candidates from correctAnswer ±1, ±2, ±table, table*(b±1)
 *   2. Filter: remove correctAnswer, negatives, zero, duplicates
 *   3. If < 3 remain, fill with random ints in [table, table*12] excluding correctAnswer
 *   4. Take first 3
 *
 * @param {number} table
 * @param {number} b - multiplier
 * @param {number} correctAnswer
 * @returns {number[]} exactly 3 wrong answers
 */
const generateWrongAnswers = (table, b, correctAnswer) => {
  const rawCandidates = [
    correctAnswer - 1,
    correctAnswer + 1,
    correctAnswer - 2,
    correctAnswer + 2,
    correctAnswer - table,
    correctAnswer + table,
    table * (b - 1),
    table * (b + 1),
  ];

  // Filter: no correctAnswer, no negatives, no zero, deduplicate
  const seen = new Set([correctAnswer]);
  const candidates = rawCandidates.filter((n) => {
    if (n <= 0) return false;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });

  // Fill up to 3 with random integers in [table, table*12] if needed
  const minVal = table;
  const maxVal = table * 12;

  let attempts = 0;
  while (candidates.length < 3 && attempts < 200) {
    attempts++;
    const rand =
      Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
    if (!seen.has(rand)) {
      seen.add(rand);
      candidates.push(rand);
    }
  }

  return candidates.slice(0, 3);
};

/**
 * Generates a full round of 12 questions for the given times table.
 * Each question has:
 *   { a, b, correctAnswer, options, questionText }
 *
 * Multipliers are 1–12, no repeats, Fisher-Yates shuffled.
 * Options are [correctAnswer, ...3 wrong answers], Fisher-Yates shuffled.
 *
 * @param {number} table - Integer 2–12
 * @returns {Array<Object>} array of 12 question objects
 */
export const generateRound = (table) => {
  // Build multipliers 1–12, shuffled
  const multipliers = fisherYates([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  return multipliers.map((b) => {
    const correctAnswer = table * b;
    const wrongAnswers = generateWrongAnswers(table, b, correctAnswer);
    const options = fisherYates([correctAnswer, ...wrongAnswers]);

    return {
      a: table,
      b,
      correctAnswer,
      options,
      questionText: `What is ${table} × ${b}?`,
    };
  });
};
