const User = require("../models/user.model");
const { getLeaderboard } = require("../controllers/scoreController");

jest.mock("../models/user.model", () => ({
  find: jest.fn(),
}));

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("leaderboard identity naming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses username first, then fullName fallback", async () => {
    const res = makeRes();

    const select = jest.fn().mockResolvedValue([
      {
        username: "ninja_1",
        fullName: "Jane Doe",
        totalScore: 100,
        gamesPlayed: 5,
      },
      {
        username: "",
        fullName: "John Smith",
        totalScore: 80,
        gamesPlayed: 4,
      },
    ]);
    const limit = jest.fn(() => ({ select }));
    const sort = jest.fn(() => ({ limit }));
    User.find.mockReturnValue({ sort });

    await getLeaderboard({}, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      leaderboard: [
        { rank: 1, name: "ninja_1", totalScore: 100, gamesPlayed: 5 },
        { rank: 2, name: "John Smith", totalScore: 80, gamesPlayed: 4 },
      ],
    });
  });

  it("omits entries with no username and no fullName", async () => {
    const res = makeRes();

    const select = jest.fn().mockResolvedValue([
      { username: "", fullName: "", totalScore: 30, gamesPlayed: 2 },
      { username: "valid_name", fullName: "", totalScore: 20, gamesPlayed: 1 },
    ]);
    const limit = jest.fn(() => ({ select }));
    const sort = jest.fn(() => ({ limit }));
    User.find.mockReturnValue({ sort });

    await getLeaderboard({}, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      leaderboard: [
        { rank: 2, name: "valid_name", totalScore: 20, gamesPlayed: 1 },
      ],
    });
  });
});
