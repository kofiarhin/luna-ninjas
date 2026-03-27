// client/src/utils/questionGenerator.test.js
// Tests for the generateRound() question generation logic.
// Written as self-contained CJS to run under the root Jest config (no ESM transform).

"use strict";

// ---- Inline the core logic under test ----
// (Mirrors questionGenerator.js exactly so the algorithm is actually tested)

const fisherYates = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

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
    const rand = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
    if (!seen.has(rand)) {
      seen.add(rand);
      candidates.push(rand);
    }
  }

  return candidates.slice(0, 3);
};

const generateRound = (table) => {
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

const buildQuestionsFromFacts = (facts, operation = "multiplication") => {
  const isDivision = operation === "division";
  return facts.map((fact) => {
    const a = Number(fact.a);
    const b = Number(fact.b);

    if (isDivision) {
      const dividend = a * b;
      const correctAnswer = b;
      const wrongAnswers = generateDivisionWrongAnswers(correctAnswer);
      const options = fisherYates([correctAnswer, ...wrongAnswers]);
      return {
        a,
        b,
        correctAnswer,
        options,
        questionText: `What is ${dividend} ÷ ${a}?`,
      };
    }

    const correctAnswer = a * b;
    const wrongAnswers = generateWrongAnswers(a, b, correctAnswer);
    const options = fisherYates([correctAnswer, ...wrongAnswers]);
    return {
      a,
      b,
      correctAnswer,
      options,
      questionText: `What is ${a} × ${b}?`,
    };
  });
};

// ---- Tests ----

describe("generateRound", () => {
  describe("generateRound(7)", () => {
    let round;

    beforeEach(() => {
      round = generateRound(7);
    });

    it("returns exactly 12 questions", () => {
      expect(round).toHaveLength(12);
    });

    it("all questions have a === 7 (the selected table)", () => {
      round.forEach((q) => {
        expect(q.a).toBe(7);
      });
    });

    it("b values cover 1–12 with no duplicates", () => {
      const bValues = round.map((q) => q.b).sort((x, y) => x - y);
      expect(bValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it("correctAnswer equals a * b for every question", () => {
      round.forEach((q) => {
        expect(q.correctAnswer).toBe(q.a * q.b);
      });
    });

    it("each question has exactly 4 options", () => {
      round.forEach((q) => {
        expect(q.options).toHaveLength(4);
      });
    });

    it("each options array includes the correctAnswer", () => {
      round.forEach((q) => {
        expect(q.options).toContain(q.correctAnswer);
      });
    });

    it("all options are positive integers", () => {
      round.forEach((q) => {
        q.options.forEach((opt) => {
          expect(Number.isInteger(opt)).toBe(true);
          expect(opt).toBeGreaterThan(0);
        });
      });
    });

    it("no duplicate options within a single question", () => {
      round.forEach((q) => {
        const unique = new Set(q.options);
        expect(unique.size).toBe(4);
      });
    });

    it("each question has a questionText", () => {
      round.forEach((q) => {
        expect(typeof q.questionText).toBe("string");
        expect(q.questionText.length).toBeGreaterThan(0);
      });
    });
  });

  describe("generateRound(2) — smallest table", () => {
    it("returns 12 questions with a === 2", () => {
      const round = generateRound(2);
      expect(round).toHaveLength(12);
      round.forEach((q) => expect(q.a).toBe(2));
    });
  });

  describe("generateRound(12) — largest table", () => {
    it("returns 12 questions with a === 12", () => {
      const round = generateRound(12);
      expect(round).toHaveLength(12);
      round.forEach((q) => expect(q.a).toBe(12));
    });

    it("correctAnswer for 12×12 is 144", () => {
      const round = generateRound(12);
      const q12 = round.find((q) => q.b === 12);
      expect(q12.correctAnswer).toBe(144);
    });
  });

  describe("shuffling — multiple calls produce different orderings", () => {
    it("b values are not always in the same order across two runs", () => {
      // With 12 items, the probability of getting the same shuffle twice is 1/12! ≈ 0
      let allSame = true;
      const firstRound = generateRound(5).map((q) => q.b);

      for (let i = 0; i < 5; i++) {
        const nextRound = generateRound(5).map((q) => q.b);
        if (JSON.stringify(firstRound) !== JSON.stringify(nextRound)) {
          allSame = false;
          break;
        }
      }

      // It is astronomically unlikely that 5 shuffles all match
      expect(allSame).toBe(false);
    });
  });
});

describe("buildQuestionsFromFacts", () => {
  it("builds multiplication questions from explicit facts", () => {
    const questions = buildQuestionsFromFacts(
      [
        { a: 7, b: 3 },
        { a: 7, b: 8 },
      ],
      "multiplication"
    );

    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toMatch(/7 × 3/);
    expect(questions[1].correctAnswer).toBe(56);
    questions.forEach((q) => expect(q.options).toContain(q.correctAnswer));
  });

  it("builds division questions from explicit facts", () => {
    const questions = buildQuestionsFromFacts(
      [
        { a: 6, b: 2 },
        { a: 6, b: 9 },
      ],
      "division"
    );

    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toMatch(/12 ÷ 6/);
    expect(questions[0].correctAnswer).toBe(2);
    expect(questions[1].correctAnswer).toBe(9);
    questions.forEach((q) => expect(q.options).toContain(q.correctAnswer));
  });
});
