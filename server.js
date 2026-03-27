require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// TEST ROUTE (IMPORTANT)
app.get("/", (req, res) => {
  res.send("AURA backend running 🚀");
});

// GOOGLE AUTH ROUTE (TEST VERSION)
app.get("/auth/google", (req, res) => {
  res.send("Google auth route working ✅");
});

// PORT FIX FOR RENDER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});