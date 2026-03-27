require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// ✅ HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.send("AURA backend running 🚀");
});

// ===============================
// 🔥 MONGODB (IMPROVED)
// ===============================

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err));

// ===============================
// 📦 SCHEMA
// ===============================

const EventSchema = new mongoose.Schema({
  title: String,
  start: Date,
  end: Date,
  type: String,
});

const Event = mongoose.model("Event", EventSchema);

// ===============================
// 🔐 AUTH
// ===============================

let savedTokens = null;

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "https://aura-backend-ns8z.onrender.com/auth/google/callback"
);

// ===============================
// 🔐 AUTH ROUTES
// ===============================

app.get("/auth/google", (req, res) => {
  console.log("🔥 HIT /auth/google");

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"]
  });

  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);

    savedTokens = tokens;
    oauth2Client.setCredentials(tokens);

    console.log("✅ Logged in");

    res.redirect("https://aura-life-operator.lovable.app/dashboard");
  } catch (err) {
    console.error("OAuth Error:", err);
    res.status(500).send("OAuth failed");
  }
});

// ===============================
// 🧠 TIME HELPERS
// ===============================

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ===============================
// 📅 GOOGLE FETCH
// ===============================

async function getTodayEvents() {
  if (!savedTokens) throw new Error("Not authenticated");

  oauth2Client.setCredentials(savedTokens);

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const start = startOfDay(new Date());
  const end = endOfDay(new Date());

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime"
  });

  return response.data.items
    .filter(e => e.start?.dateTime)
    .map(e => ({
      title: e.summary,
      start: new Date(e.start.dateTime),
      end: new Date(e.end.dateTime)
    }));
}

// ===============================
// 🔄 SYNC
// ===============================

async function syncToDB(events) {
  await Event.deleteMany({});
  await Event.insertMany(
    events.map(e => ({
      ...e,
      type: e.title.includes("Deep Work") ? "deepwork" : "meeting"
    }))
  );
}

app.get("/sync", async (req, res) => {
  try {
    if (!savedTokens) return res.status(401).send("Login first");

    const events = await getTodayEvents();
    await syncToDB(events);

    res.json({ count: events.length, events });
  } catch (err) {
    console.error("SYNC ERROR:", err);
    res.status(500).send("Sync failed");
  }
});

// ===============================
// 📅 EVENTS TODAY
// ===============================

app.get("/events/today", async (req, res) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());

    const events = await Event.find({
      start: { $gte: start, $lte: end }
    }).sort({ start: 1 });

    res.json(events);
  } catch (err) {
    console.error("Events Today Error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ===============================
// ⚡ ENERGY
// ===============================

app.get("/energy", (req, res) => {
  const currentHour = new Date().getHours();
  const data = [];

  for (let i = 8; i <= 20; i++) {
    let energy = "high";

    if (i >= 13 && i <= 15) energy = "low";
    if (i >= 18) energy = "moderate";
    if (i < currentHour) energy = "past";

    data.push({ hour: i, energy });
  }

  res.json(data);
});

// ===============================
// 🚀 START
// ===============================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 AURA running on ${PORT}`);
});