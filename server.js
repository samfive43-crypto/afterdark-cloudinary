require("dotenv").config();
const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const required = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "ADMIN_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("Missing environment variables:", missing.join(", "));
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(session({
  name: "afterdark.sid",
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE !== "false",
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public")));

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Please sign in to the upload dashboard." });
};

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body.password || "");
  const expected = process.env.ADMIN_PASSWORD;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return res.status(401).json({ error: "Incorrect password." });
  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// The browser receives a short-lived upload signature, never the API secret.
app.post("/api/admin/sign-upload", requireAdmin, (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "afterdark/highlights";
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature
  });
});

// Only publicly delivered videos in the AFTERDARK highlights folder are listed.
app.get("/api/videos", async (_req, res) => {
  try {
    const result = await cloudinary.api.resources({
      resource_type: "video",
      type: "upload",
      prefix: "afterdark/highlights/",
      max_results: 100
    });
    const videos = (result.resources || []).map((item) => ({
      publicId: item.public_id,
      title: (item.public_id.split("/").pop() || "Match highlight")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      // HLS adaptive stream: Cloudinary creates renditions up to 1080p on demand.
      hlsUrl: cloudinary.url(item.public_id, {
        resource_type: "video",
        streaming_profile: "auto",
        format: "m3u8",
        secure: true
      }),
      // Compressed MP4 fallback for browsers without HLS support.
      mp4Url: cloudinary.url(item.public_id, {
        resource_type: "video",
        quality: "auto",
        fetch_format: "auto",
        secure: true
      }),
      createdAt: item.created_at,
      duration: item.duration || null,
      width: item.width || null,
      height: item.height || null
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.set("Cache-Control", "public, max-age=30");
    res.json({ videos });
  } catch (error) {
    console.error("Cloudinary list error:", error.message);
    res.status(502).json({ error: "Could not load highlights from Cloudinary." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`AFTERDARK running on port ${port}`));
