// server/constants/scoring.js
// Weight map: table number → points per correct answer
// Formula: table - 1 (table 2 = 1pt, table 12 = 11pts)
const WEIGHT_MAP = {
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

module.exports = { WEIGHT_MAP };
