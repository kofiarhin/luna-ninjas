// client/src/utils/questionGenerator.js
// Generates a fresh round of 12 questions for a given table and operation.

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
 * Generate 3 wrong answer candidates for a multiplication question.
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

  const seen = new Set([correctAnswer]);
  const candidates = rawCandidates.filter((n) => {
    if (n <= 0) return false;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });

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
 * Generate 3 wrong answer candidates for a division question.
 * Quotients are small positive integers (1–12), so offsets are ±1, ±2, ±3.
 * @param {number} correctAnswer - the quotient (1–12)
 * @returns {number[]} exactly 3 wrong answers
 */
const generateDivisionWrongAnswers = (correctAnswer) => {
  const rawCandidates = [
    correctAnswer - 1,
    correctAnswer + 1,
    correctAnswer - 2,
    correctAnswer + 2,
    correctAnswer - 3,
    correctAnswer + 3,
  ];

  const seen = new Set([correctAnswer]);
  const candidates = rawCandidates.filter((n) => {
    if (n <= 0) return false;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });

  // Fill with random positive integers in [1, 12] if needed
  let attempts = 0;
  while (candidates.length < 3 && attempts < 200) {
    attempts++;
    const rand = Math.floor(Math.random() * 12) + 1;
    if (!seen.has(rand)) {
      seen.add(rand);
      candidates.push(rand);
    }
  }

  return candidates.slice(0, 3);
};

/**
 * Generates a full round of 12 multiplication questions for the given table.
 * Each question: { a, b, correctAnswer, options, questionText }
 *
 * a = table, b = multiplier (1–12), correctAnswer = a * b
 *
 * @param {number} table - Integer 2–12
 * @returns {Array<Object>} array of 12 question objects
 */
export const generateRound = (table) => {
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

/**
 * Generates a full round of 12 division questions for the given table.
 * Each question: { a, b, correctAnswer, options, questionText }
 *
 * a = table (divisor), b = quotient (multiplier index 1–12)
 * Display: "What is {dividend} ÷ {table}?" where dividend = table * b
 * correctAnswer = b (the quotient)
 *
 * @param {number} table - Integer 2–12 (the divisor)
 * @returns {Array<Object>} array of 12 question objects
 */
export const generateDivisionRound = (table) => {
  const quotients = fisherYates([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  return quotients.map((b) => {
    const dividend = table * b;
    const correctAnswer = b;
    const wrongAnswers = generateDivisionWrongAnswers(correctAnswer);
    const options = fisherYates([correctAnswer, ...wrongAnswers]);

    return {
      a: table,
      b,
      correctAnswer,
      options,
      questionText: `What is ${dividend} ÷ ${table}?`,
    };
  });
};
