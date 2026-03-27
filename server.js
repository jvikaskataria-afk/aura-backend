require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// 🔥 IMPORTANT FOR RENDER
app.set("trust proxy", 1);

// Middleware
app.use(cors());
app.use(express.json());

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("AURA backend running 🚀");
});

// TEST GOOGLE ROUTE
app.get("/auth/google", (req, res) => {
  res.send("Google auth route working ✅");
});

// PORT FIX
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});