jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));

jest.mock("../models/user.model", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

process.env.JWT_SECRET = "test-secret";

const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const {
  registerUser,
  updateProfile,
} = require("../controllers/authController");

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("auth identity flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerUser", () => {
    it("registers with only fullName, email, and password", async () => {
      const req = {
        body: {
          fullName: "  Jane Doe  ",
          email: "  Jane@Example.com ",
          password: "password123",
        },
      };
      const res = makeRes();
      const next = jest.fn();

      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed-pass");
      User.create.mockResolvedValue({
        _id: "user_1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        displayName: "Jane Doe",
        profileImage: "",
      });

      await registerUser(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: "jane@example.com" });
      expect(User.create).toHaveBeenCalledWith({
        fullName: "Jane Doe",
        email: "jane@example.com",
        passwordHash: "hashed-pass",
        displayName: "Jane Doe",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            fullName: "Jane Doe",
            email: "jane@example.com",
          }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("ignores username when stale clients still send it", async () => {
      const req = {
        body: {
          fullName: "Jane Doe",
          email: "jane@example.com",
          password: "password123",
          username: "stale_username",
        },
      };
      const res = makeRes();

      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed-pass");
      User.create.mockResolvedValue({
        _id: "user_1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        displayName: "Jane Doe",
        username: undefined,
      });

      await registerUser(req, res, jest.fn());

      expect(User.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ username: expect.anything() }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("rejects missing fullName/email/password", async () => {
      const req = {
        body: {
          fullName: "",
          email: "",
          password: "",
        },
      };
      const res = makeRes();

      await registerUser(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: {
          fullName: "Full name is required",
          email: "Email is required",
          password: "Password is required",
        },
      });
      expect(User.create).not.toHaveBeenCalled();
    });
  });

  describe("updateProfile username behavior", () => {
    it("can add or update username and normalizes it", async () => {
      const req = {
        auth: { userId: "user_1" },
        body: { username: "  NINJA_42 " },
      };
      const res = makeRes();

      User.findOne.mockResolvedValue(null);
      User.findByIdAndUpdate.mockResolvedValue({
        _id: "user_1",
        fullName: "Jane Doe",
        username: "ninja_42",
        email: "jane@example.com",
      });

      await updateProfile(req, res, jest.fn());

      expect(User.findOne).toHaveBeenCalledWith({
        username: "ninja_42",
        _id: { $ne: "user_1" },
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "user_1",
        { username: "ninja_42" },
        { new: true },
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("returns conflict for duplicate username", async () => {
      const req = {
        auth: { userId: "user_1" },
        body: { username: "taken_name" },
      };
      const res = makeRes();

      User.findOne.mockResolvedValue({ _id: "user_2", username: "taken_name" });

      await updateProfile(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "username_taken" });
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("treats blank username as unset", async () => {
      const req = {
        auth: { userId: "user_1" },
        body: { username: "   " },
      };
      const res = makeRes();

      User.findOne.mockResolvedValue(null);
      User.findByIdAndUpdate.mockResolvedValue({
        _id: "user_1",
        fullName: "Jane Doe",
        username: undefined,
        email: "jane@example.com",
      });

      await updateProfile(req, res, jest.fn());

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "user_1",
        { username: undefined },
        { new: true },
      );
      expect(res.json).toHaveBeenCalled();
    });
  });
});
