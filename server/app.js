const express = require("express");
const cors = require("cors");
const questionRoutes = require("./routes/questionRoutres");

const app = express();

// setup middleware
app.use(cors());
app.use(express.json());

app.get("/", async (req, res, next) => {
  return res.json({ message: "hello world" });
});

app.use("/api/questions", questionRoutes);

module.exports = app;
