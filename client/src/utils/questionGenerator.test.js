// client/src/utils/questionGenerator.test.js
// Tests for questionGenerator.js using the real exported module source.
// Root Jest config is CJS/no-transform, so this loads the source and evaluates it.

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const modulePath = path.resolve(__dirname, "./questionGenerator.js");
const source = fs.readFileSync(modulePath, "utf8");
const compiled = `${source.replace(/export const /g, "const ")}
module.exports = { generateRound, generateDivisionRound, buildQuestionsFromFacts };`;

const sandbox = {
  module: { exports: {} },
  exports: {},
  Math,
  Set,
};

vm.runInNewContext(compiled, sandbox, { filename: "questionGenerator.js" });

const { generateRound, buildQuestionsFromFacts } = sandbox.module.exports;

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
