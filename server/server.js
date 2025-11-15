const express = require("express");
const dotenv = require("dotenv").config();
const app = express();

const PORT = process.env.PORT || 5000;

app.get("/", async (req, res, next) => {
  return res.json({ message: "hello world" });
});
app.listen(PORT, () => {
  console.log("server started on port:", PORT);
});
