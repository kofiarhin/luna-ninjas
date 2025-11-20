const express = require("express");

const app = express();

app.get("/", async (req, res, next) => {
  return res.json({ message: "hello world" });
});

module.exports = app;
