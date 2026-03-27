require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();

// ✅ IMPORTANT: trust proxy (needed for Render + sessions)
app.set("trust proxy", 1);

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// ✅ Session config (fixed for production)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // required on HTTPS (Render)
      httpOnly: true,
      sameSite: "none",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ✅ Passport config
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      // ✅ IMPORTANT: full URL for production
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://aura-backend-ns8z.onrender.com/auth/google/callback"
          : "/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

// Session handling
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes
app.get("/", (req, res) => {
  res.send("AURA backend running 🚀");
});

// ✅ Google login
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// ✅ Callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.send(`
      <h2>Login Successful 🚀</h2>
      <p>You are authenticated with Google.</p>
    `);
  }
);

// ✅ Get user
app.get("/user", (req, res) => {
  res.send(req.user || "No user logged in");
});

// ✅ Logout (fixed)
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) return res.send("Error logging out");
    res.send("Logged out");
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});