require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 FORCE TEST ROUTE
app.get("/", (req, res) => {
  console.log("ROOT HIT");
  res.send("AURA backend running 🚀");
});

// 🔥 FORCE TEST ROUTE 2
app.get("/auth/google", (req, res) => {
  console.log("GOOGLE ROUTE HIT");
  res.send("Google auth route working ✅");
});

// 🔥 CATCH ALL (IMPORTANT)
app.use((req, res) => {
  console.log("UNKNOWN ROUTE:", req.url);
  res.status(404).send("Route not found ❌");
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🔥 SERVER STARTED");
  console.log("PORT:", PORT);
});