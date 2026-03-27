require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// 🔥 MONGODB
// ===============================

mongoose.connect(process.env.MONGO_URI)
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
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://aura-backend-17pj.onrender.com/auth/google/callback"
);
);

// ===============================
// 🔐 AUTH ROUTES
// ===============================

app.get("/auth/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"]
  });
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  const { tokens } = await oauth2Client.getToken(req.query.code);
  savedTokens = tokens;
  oauth2Client.setCredentials(tokens);

 res.redirect("https://aura-life-operator.lovable.app/dashboard");
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
  oauth2Client.setCredentials(savedTokens);

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const start = startOfDay(new Date());
  const end = endOfDay(new Date());

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime"
  });

  return res.data.items
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
  if (!savedTokens) return res.send("Login first");

  const events = await getTodayEvents();
  await syncToDB(events);

  res.json({ count: events.length, events });
});

// ===============================
// 📅 EVENTS TODAY (FIXED)
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
// 🧠 AI INSIGHTS (FIXED)
// ===============================

app.get("/insights", async (req, res) => {
  try {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());

    const events = await Event.find({
      start: { $gte: start, $lte: end }
    });

    const meetings = events.filter(e => e.type === "meeting");
    const deepwork = events.filter(e => e.type === "deepwork");

    let insights = [];

    if (meetings.length >= 3) {
      insights.push("⚠️ Too many meetings today.");
    }

    if (deepwork.length === 0) {
      insights.push("🧠 No deep work scheduled.");
    }

    const totalHours = events.reduce((sum, e) => {
      return sum + (new Date(e.end) - new Date(e.start)) / (1000 * 60 * 60);
    }, 0);

    if (totalHours > 8) {
      insights.push("🔥 Overloaded schedule.");
    }

    if (insights.length === 0) {
      insights.push("✅ Balanced day.");
    }

    res.json({ insights });

  } catch (err) {
    console.error("Insights Error:", err);
    res.status(500).json({ error: "Insights failed" });
  }
});

// ===============================
// 🔥 FIX MY DAY (FINAL)
// ===============================

app.get("/events/fix", async (req, res) => {
  try {
    const now = new Date();

    const existing = await Event.find({
      type: "deepwork",
      end: { $gt: now }
    });

    if (existing.length > 0) {
      return res.json({
        success: true,
        message: "Already optimized",
        events: existing
      });
    }

    await Event.deleteMany({
      type: "deepwork",
      end: { $lt: now }
    });

    const events = await Event.find().sort({ start: 1 });

    const futureEvents = events.filter(e => new Date(e.end) > now);

    let pointer = new Date(now);

    for (let i = 0; i < futureEvents.length; i++) {
      const eventStart = new Date(futureEvents[i].start);
      const eventEnd = new Date(futureEvents[i].end);

      if (eventStart - pointer >= 60 * 60 * 1000) {
        const start = new Date(pointer);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const newEvent = await Event.create({
          title: "🔥 Deep Work",
          start,
          end,
          type: "deepwork"
        });

        return res.json({ success: true, event: newEvent });
      }

      if (eventEnd > pointer) pointer = new Date(eventEnd);
    }

    const start = new Date(pointer);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const newEvent = await Event.create({
      title: "🔥 Deep Work",
      start,
      end,
      type: "deepwork"
    });

    res.json({ success: true, event: newEvent });

  } catch (err) {
    console.error("Fix My Day Error:", err);
    res.status(500).json({ error: "Fix failed" });
  }
});

// ===============================
// 🚀 START
// ===============================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`🚀 AURA running on ${PORT}`));