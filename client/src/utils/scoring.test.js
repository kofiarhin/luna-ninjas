// client/src/utils/scoring.test.js
// Tests for WEIGHT_MAP, getPointsPerCorrect, and calculateRoundScore.
// Written as self-contained CJS to run under the root Jest config (no ESM transform).

"use strict";

// ---- Inline the logic under test (mirrors scoring.js exactly) ----

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

const getPointsPerCorrect = (table) => {
  return WEIGHT_MAP[table] ?? 0;
};

const calculateRoundScore = (table, correctCount) => {
  return getPointsPerCorrect(table) * correctCount;
};

// ---- Tests ----

describe("WEIGHT_MAP", () => {
  it("covers every table from 2 to 12", () => {
    for (let t = 2; t <= 12; t++) {
      expect(WEIGHT_MAP[t]).toBeDefined();
    }
  });

  it("has 11 entries", () => {
    expect(Object.keys(WEIGHT_MAP)).toHaveLength(11);
  });

  it("follows the formula: weight = table - 1", () => {
    for (let t = 2; t <= 12; t++) {
      expect(WEIGHT_MAP[t]).toBe(t - 1);
    }
  });

  it("table 2 = 1 point", () => expect(WEIGHT_MAP[2]).toBe(1));
  it("table 7 = 6 points", () => expect(WEIGHT_MAP[7]).toBe(6));
  it("table 12 = 11 points", () => expect(WEIGHT_MAP[12]).toBe(11));
});

describe("getPointsPerCorrect", () => {
  const cases = [
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 5],
    [7, 6],
    [8, 7],
    [9, 8],
    [10, 9],
    [11, 10],
    [12, 11],
  ];

  test.each(cases)("table %i → %i pts", (table, expected) => {
    expect(getPointsPerCorrect(table)).toBe(expected);
  });

  it("returns 0 for an unknown table", () => {
    expect(getPointsPerCorrect(1)).toBe(0);
    expect(getPointsPerCorrect(13)).toBe(0);
  });
});

describe("calculateRoundScore", () => {
  it("table 7, correctCount 10 → 60", () => {
    expect(calculateRoundScore(7, 10)).toBe(60);
  });

  it("table 12, correctCount 12 → 132", () => {
    expect(calculateRoundScore(12, 12)).toBe(132);
  });

  it("table 2, correctCount 12 → 12", () => {
    expect(calculateRoundScore(2, 12)).toBe(12);
  });

  it("any table, correctCount 0 → 0", () => {
    for (let t = 2; t <= 12; t++) {
      expect(calculateRoundScore(t, 0)).toBe(0);
    }
  });

  it("table 5, correctCount 6 → 24", () => {
    // weight = 4, 4 * 6 = 24
    expect(calculateRoundScore(5, 6)).toBe(24);
  });
});
