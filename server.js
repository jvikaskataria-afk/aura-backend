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
// 🔥 SESSION
// ===============================

app.use(session({
  secret: "supersecret",
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
// 🔥 MONGODB
// ===============================

mongoose.connect(process.env.MONGO_URI)
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
// 🔐 GOOGLE AUTH
// ===============================

let savedTokens = null;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://aura-backend-ns8z.onrender.com/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {

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
    scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"]
  })
);

// 👉 CALLBACK
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.send("Login successful 🚀");
  }
);

// ===============================
// 📅 GOOGLE CALENDAR
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

async function getTodayEvents() {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials(savedTokens);

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay(new Date()).toISOString(),
    timeMax: endOfDay(new Date()).toISOString(),
    singleEvents: true,
    orderBy: "startTime"
  });

  return res.data.items.map(e => ({
    title: e.summary,
    start: new Date(e.start.dateTime),
    end: new Date(e.end.dateTime)
  }));
}

// ===============================
// 🔥 SYNC ROUTE (THIS WAS MISSING)
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
// 📅 FETCH EVENTS
// ===============================

app.get("/events/today", async (req, res) => {
  const events = await Event.find().sort({ start: 1 });
  res.json(events);
});

// ===============================
// 🚀 START
// ===============================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});