// client/src/utils/scoring.js
// Mirrors server/constants/scoring.js for client-side score display.
// The backend always recomputes the authoritative score — these values are for UI only.

export const WEIGHT_MAP = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  11: 10,
  12: 11,
};

/**
 * Returns the points awarded per correct answer for a given table.
 * @param {number} table - Integer 2–12
 * @returns {number}
 */
export const getPointsPerCorrect = (table) => {
  return WEIGHT_MAP[table] ?? 0;
};

/**
 * Calculates the total round score.
 * @param {number} table - Integer 2–12
 * @param {number} correctCount - Integer 0–12
 * @returns {number}
 */
export const calculateRoundScore = (table, correctCount) => {
  return getPointsPerCorrect(table) * correctCount;
};
