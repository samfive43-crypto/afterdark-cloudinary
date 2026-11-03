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
  cookie: { httpOnly: true, sameSite: "strict", secure: process.env.COOKIE_SECURE !== "false", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

const requireAdmin = (req, res, next) => req.session?.isAdmin
  ? next()
  : res.status(401).json({ error: "Please sign in to the upload dashboard." });

const clean = (value, max = 180) => String(value || "").trim().slice(0, max);
const toContext = (data) => ({
  title: clean(data.title),
  league: clean(data.league, 100),
  home: clean(data.home, 100),
  away: clean(data.away, 100),
  matchDate: clean(data.matchDate, 30),
  thumbnailUrl: clean(data.thumbnailUrl, 1000)
});
// Encode values as base64url before putting them in Cloudinary context.
// This avoids Cloudinary interpreting percent escapes in URLs (especially
// custom thumbnail URLs) as malformed context encoding. Keep the keys simple.
const encodeContextValue = (value) => Buffer.from(String(value), "utf8").toString("base64url");
const decodeContextValue = (value) => {
  if (typeof value !== "string" || !value) return "";
  try { return Buffer.from(value, "base64url").toString("utf8"); }
  catch { return ""; }
};
const contextString = (data) => Object.entries(data)
  .filter(([, value]) => value)
  .map(([key, value]) => `ad_${key}=${encodeContextValue(value)}`)
  .join("|");
const readContext = (ctx, key) => {
  // Support metadata saved by older versions as well as the encoded format.
  const encoded = ctx?.[`ad_${key}`];
  return encoded ? decodeContextValue(encoded) : (ctx?.[key] || "");
};

app.post("/api/admin/login", (req, res) => {
  const a = Buffer.from(String(req.body.password || ""));
  const b = Buffer.from(process.env.ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Incorrect password." });
  req.session.isAdmin = true;
  res.json({ ok: true });
});
app.post("/api/admin/logout", requireAdmin, (req, res) => req.session.destroy(() => res.json({ ok: true })));

// Short-lived signatures for browser-to-Cloudinary uploads. The API secret stays on the server.
app.post("/api/admin/sign-upload", requireAdmin, (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "afterdark/highlights";
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  res.json({ cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, timestamp, folder, signature });
});
app.post("/api/admin/sign-thumbnail", requireAdmin, (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "afterdark/thumbnails";
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  res.json({ cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, timestamp, folder, signature });
});

// Save editable match details against the Cloudinary video. This survives Render restarts/redeploys.
app.post("/api/admin/metadata", requireAdmin, async (req, res) => {
  try {
    const publicId = clean(req.body.publicId, 500);
    if (!publicId.startsWith("afterdark/highlights/")) return res.status(400).json({ error: "Invalid highlight." });
    const data = toContext(req.body);
    if (!data.title) return res.status(400).json({ error: "Enter a match title." });
    await cloudinary.api.update(publicId, {
      resource_type: "video",
      type: "upload",
      context: contextString(data)
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Metadata update error:", {
      message: error.message,
      http_code: error.http_code,
      name: error.name,
      error: error.error?.message || error.message || String(error)
    });
    res.status(502).json({ error: "Could not save match details. Check the Cloudinary asset and try again." });
  }
});

app.get("/api/videos", async (_req, res) => {
  try {
    const result = await cloudinary.api.resources({
      resource_type: "video", type: "upload", prefix: "afterdark/highlights/",
      max_results: 100, context: true
    });
    const videos = (result.resources || []).map((item) => {
      const ctx = item.context?.custom || item.context || {};
      const meta = {
        title: readContext(ctx, "title"),
        league: readContext(ctx, "league"),
        home: readContext(ctx, "home"),
        away: readContext(ctx, "away"),
        matchDate: readContext(ctx, "matchDate"),
        thumbnailUrl: readContext(ctx, "thumbnailUrl")
      };
      const fallback = (item.public_id.split("/").pop() || "Match highlight")
        .replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const thumb = meta.thumbnailUrl || cloudinary.url(item.public_id, {
        resource_type: "video", format: "jpg", secure: true,
        transformation: [{ start_offset: "2" }, { width: 800, height: 450, crop: "fill", quality: "auto" }]
      });
      return {
        publicId: item.public_id,
        title: meta.title || fallback,
        league: meta.league || "Uncategorised",
        home: meta.home || "",
        away: meta.away || "",
        matchDate: meta.matchDate || "",
        thumbnailUrl: thumb,
        hlsUrl: cloudinary.url(item.public_id, { resource_type: "video", streaming_profile: "auto", format: "m3u8", secure: true }),
        mp4Url: cloudinary.url(item.public_id, { resource_type: "video", quality: "auto", fetch_format: "auto", secure: true }),
        createdAt: item.created_at, duration: item.duration || null
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.set("Cache-Control", "public, max-age=30");
    res.json({ videos });
  } catch (error) {
    console.error("Cloudinary list error:", error.message);
    res.status(502).json({ error: "Could not load highlights from Cloudinary." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`AFTERDARK running on port ${port}`));
