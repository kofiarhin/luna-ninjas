// server/tests/insights.smart-round.test.js

jest.mock("../models/factMastery.model", () => ({
  find: jest.fn(),
}));

const FactMastery = require("../models/factMastery.model");
const {
  getSmartRoundPlan,
  __testables,
} = require("../controllers/insightController");

const createRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("insightController smart-round", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid operation", async () => {
    const req = {
      auth: { userId: "u1" },
      query: { operation: "addition", table: "7" },
    };
    const res = createRes();

    await getSmartRoundPlan(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/operation/i) })
    );
  });

  it("returns table-specific multiplication candidates and lowData=true when fewer than 6 attempted facts", async () => {
    FactMastery.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { factA: 1, factB: 7, correct: 0, wrong: 2, lastSeen: new Date("2026-01-01") },
          { factA: 2, factB: 7, correct: 3, wrong: 1, lastSeen: new Date("2026-01-02") },
          { factA: 3, factB: 7, correct: 1, wrong: 0, lastSeen: new Date("2026-01-03") },
        ]),
      }),
    });

    const req = {
      auth: { userId: "u1" },
      query: { operation: "multiplication", table: "7" },
    };
    const res = createRes();

    await getSmartRoundPlan(req, res);

    expect(FactMastery.find).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        operation: "multiplication",
      })
    );

    const payload = res.json.mock.calls[0][0];
    expect(payload.facts).toHaveLength(12);
    payload.facts.forEach((f) => {
      expect(f.operation).toBe("multiplication");
      expect(f.a).toBe(7);
      expect(f.b).toBeGreaterThanOrEqual(1);
      expect(f.b).toBeLessThanOrEqual(12);
    });
    expect(payload.lowData).toBe(true);
  });

  it("keeps division operation isolated and returns all facts tagged as division", async () => {
    FactMastery.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { factA: 7, factB: 2, correct: 0, wrong: 3, lastSeen: new Date("2026-02-01") },
          { factA: 7, factB: 4, correct: 6, wrong: 0, lastSeen: new Date("2026-02-02") },
        ]),
      }),
    });

    const req = {
      auth: { userId: "u1" },
      query: { operation: "division", table: "7" },
    };
    const res = createRes();

    await getSmartRoundPlan(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.facts).toHaveLength(12);
    payload.facts.forEach((f) => {
      expect(f.operation).toBe("division");
      expect(f.a).toBe(7);
    });
  });

  it("classifies buckets with expected thresholds", () => {
    expect(__testables.classifyBucket(0, 0)).toBe("unseen");
    expect(__testables.classifyBucket(1, 0)).toBe("learning");
    expect(__testables.classifyBucket(2, 0.59)).toBe("weak");
    expect(__testables.classifyBucket(2, 0.6)).toBe("learning");
    expect(__testables.classifyBucket(2, 0.85)).toBe("strong");
  });
});
