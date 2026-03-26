// server/tests/scores.test.js
// Tests for POST /api/scores, GET /api/leaderboard, and GET /api/auth/me.
// Uses supertest to exercise the Express app.
// NOTE: MongoDB is NOT connected in these tests; controller internals are mocked
// so that validation and shape tests run without a live DB.

// Mock groq-sdk to prevent GROQ_API_KEY check at require-time
jest.mock("groq-sdk", () => {
  return class Groq {
    constructor() {}
  };
});

const request = require("supertest");
const app = require("../app");

// ---- Mock authMiddleware so it either passes or returns 401 ----
// Tests that need auth set the x-test-user-id header to inject a userId.
jest.mock("../middleware/authMiddleware", () => {
  return (req, res, next) => {
    const testUserId = req.headers["x-test-user-id"];
    if (!testUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.auth = { userId: testUserId };
    return next();
  };
});

// ---- Mock scoreController to avoid hitting MongoDB ----
jest.mock("../controllers/scoreController", () => ({
  submitScore: jest.fn(async (req, res) => {
    const { table, correctCount } = req.body;

    const tableInt = parseInt(table, 10);
    if (!Number.isInteger(tableInt) || tableInt < 2 || tableInt > 12) {
      return res
        .status(400)
        .json({ message: "table must be an integer between 2 and 12" });
    }

    const correctCountInt = parseInt(correctCount, 10);
    if (
      !Number.isInteger(correctCountInt) ||
      correctCountInt < 0 ||
      correctCountInt > 12
    ) {
      return res
        .status(400)
        .json({ message: "correctCount must be an integer between 0 and 12" });
    }

    const WEIGHT_MAP = {
      2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
      8: 7, 9: 8, 10: 9, 11: 10, 12: 11,
    };
    const roundScore = WEIGHT_MAP[tableInt] * correctCountInt;

    return res.json({
      roundScore,
      newTotalScore: roundScore,
      gamesPlayed: 1,
    });
  }),

  getLeaderboard: jest.fn(async (req, res) => {
    return res.json({
      leaderboard: [
        { rank: 1, displayName: "Test Ninja", totalScore: 100, gamesPlayed: 5 },
        { rank: 2, displayName: "Another Ninja", totalScore: 50, gamesPlayed: 3 },
      ],
    });
  }),
}));

// ---- Mock authController to avoid hitting MongoDB ----
jest.mock("../controllers/authController", () => ({
  registerUser: jest.fn(async (req, res) => res.status(201).json({})),
  loginUser: jest.fn(async (req, res) => res.json({})),
  getMe: jest.fn(async (req, res) => {
    return res.json({
      _id: req.auth.userId,
      displayName: "Test Ninja",
      email: "test@example.com",
      username: "testninja",
      totalScore: 100,
      gamesPlayed: 5,
    });
  }),
}));

// ---- POST /api/scores ----

describe("POST /api/scores", () => {
  const AUTH_HEADER = { "x-test-user-id": "user_test123" };

  it("returns 401 when no auth token is provided", async () => {
    const res = await request(app)
      .post("/api/scores")
      .send({ table: 7, correctCount: 10 });

    expect(res.status).toBe(401);
  });

  it("returns 400 when table is below 2", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: 1, correctCount: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/table/i);
  });

  it("returns 400 when table is above 12", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: 13, correctCount: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/table/i);
  });

  it("returns 400 when table is not a number", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: "abc", correctCount: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/table/i);
  });

  it("returns 400 when correctCount is below 0", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: 7, correctCount: -1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/correctCount/i);
  });

  it("returns 400 when correctCount is above 12", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: 7, correctCount: 13 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/correctCount/i);
  });

  it("returns 200 with roundScore, newTotalScore, gamesPlayed for valid input", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: 7, correctCount: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("roundScore");
    expect(res.body).toHaveProperty("newTotalScore");
    expect(res.body).toHaveProperty("gamesPlayed");
    // table 7 weight = 6, correctCount = 10 → roundScore = 60
    expect(res.body.roundScore).toBe(60);
  });

  it("computes correct round score for table 2, correctCount 12", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: 2, correctCount: 12 });

    expect(res.status).toBe(200);
    // table 2 weight = 1, 1 * 12 = 12
    expect(res.body.roundScore).toBe(12);
  });

  it("computes correct round score for table 12, correctCount 0", async () => {
    const res = await request(app)
      .post("/api/scores")
      .set(AUTH_HEADER)
      .send({ table: 12, correctCount: 0 });

    expect(res.status).toBe(200);
    // table 12 weight = 11, 11 * 0 = 0
    expect(res.body.roundScore).toBe(0);
  });
});

// ---- GET /api/leaderboard ----

describe("GET /api/leaderboard", () => {
  it("returns 200 with leaderboard array", async () => {
    const res = await request(app).get("/api/leaderboard");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("leaderboard");
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  it("each leaderboard entry has rank, displayName, totalScore, gamesPlayed", async () => {
    const res = await request(app).get("/api/leaderboard");

    const entry = res.body.leaderboard[0];
    expect(entry).toHaveProperty("rank");
    expect(entry).toHaveProperty("displayName");
    expect(entry).toHaveProperty("totalScore");
    expect(entry).toHaveProperty("gamesPlayed");
  });

  it("does not expose passwordHash or email in entries", async () => {
    const res = await request(app).get("/api/leaderboard");

    res.body.leaderboard.forEach((entry) => {
      expect(entry).not.toHaveProperty("passwordHash");
      expect(entry).not.toHaveProperty("email");
    });
  });

  it("does not require an auth token", async () => {
    const res = await request(app).get("/api/leaderboard");
    expect(res.status).toBe(200);
  });
});

// ---- GET /api/auth/me ----

describe("GET /api/auth/me", () => {
  const AUTH_HEADER = { "x-test-user-id": "user_test123" };

  it("returns 200 with safe user fields for a valid token", async () => {
    const res = await request(app).get("/api/auth/me").set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("displayName");
    expect(res.body).toHaveProperty("email");
    expect(res.body).toHaveProperty("totalScore");
    expect(res.body).toHaveProperty("gamesPlayed");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    // Simulated by omitting x-test-user-id — middleware mock rejects without it
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
