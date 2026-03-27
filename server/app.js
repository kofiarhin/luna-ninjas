const express = require("express");
const cors = require("cors");
const questionRoutes = require("./routes/questionRoutres");
const authRoutes = require("./routes/authRoutes");
const scoreRoutes = require("./routes/scoreRoutes");
const insightRoutes = require("./routes/insightRoutes");

const app = express();

// setup middleware
app.use(cors());
app.use(express.json());

app.get("/", async (req, res, next) => {
  return res.json({ message: "hello world" });
});

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);

// Score routes: POST /api/scores and GET /api/leaderboard
app.use("/api", scoreRoutes);

app.use("/api/insights", insightRoutes);

// Global error handler — always return JSON, never HTML
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

module.exports = app;
