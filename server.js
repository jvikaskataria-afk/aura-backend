require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { google } = require("googleapis");

const app = express();

// ===============================
// ⚙️ BASIC SETUP
// ===============================

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// ===============================
// 🔥 SESSION (FIXED FOR RENDER)
// ===============================

app.use(session({
  secret: process.env.SESSION_SECRET || "supersecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: "none",
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ===============================
// 🔥 MONGODB (FIXED)
// ===============================

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ Mongo Error:", err));

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
// 🔐 GOOGLE AUTH (FIXED)
// ===============================

let savedTokens = null;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://aura-backend-ns8z.onrender.com/auth/google/callback"
},
(accessToken, refreshToken, profile, done) => {

  savedTokens = {
    access_token: accessToken,
    refresh_token: refreshToken,
  };

  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ===============================
// 🔐 ROUTES
// ===============================

app.get("/", (req, res) => {
  res.send("AURA backend running 🚀");
});

// 👉 LOGIN
app.get("/auth/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/calendar"
    ],
    accessType: "offline",
    prompt: "consent"
  })
);

// 👉 CALLBACK
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("https://aura-life-operator.lovable.app/dashboard");
  }
);

// ===============================
// ⚡ FIX MY DAY
// ===============================

app.post("/fix-day", async (req, res) => {
  try {
    const events = await Event.find().sort({ start: 1 });

    if (!events.length) {
      return res.json({
        message: "No events to optimize",
        suggestion: "Add events first"
      });
    }

    const suggestion = "Move meetings to afternoon and add Deep Work in morning";

    res.json({
      message: "Day optimized 🚀",
      suggestion,
      events
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to optimize day" });
  }
});

// ===============================
// 📅 GOOGLE CALENDAR (FIXED)
// ===============================

async function getTodayEvents() {
  if (!savedTokens) return [];

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials(savedTokens);

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().setHours(0,0,0,0),
    timeMax: new Date().setHours(23,59,59,999),
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

app.get("/sync", async (req, res) => {
  try {
    if (!savedTokens) {
      return res.send("Login first");
    }

    const events = await getTodayEvents();

    await Event.deleteMany({});
    await Event.insertMany(
      events.map(e => ({
        ...e,
        type: e.title?.includes("Deep Work") ? "deepwork" : "meeting"
      }))
    );

    res.json({
      message: "Synced successfully 🚀",
      count: events.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Sync failed");
  }
});

// ===============================
// 📅 EVENTS TODAY
// ===============================

app.get("/events/today", async (req, res) => {
  try {
    const events = await Event.find().sort({ start: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ===============================
// 🚀 START
// ===============================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});