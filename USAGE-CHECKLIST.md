# AFTERDARK launch and usage checklist

## Before sharing the link
- [ ] Confirm Cloudinary videos are in `afterdark/highlights` and use public `upload` delivery.
- [ ] Deploy the complete Node.js project over HTTPS.
- [ ] Set all environment variables on the server, including a long `ADMIN_PASSWORD` and stable `SESSION_SECRET`.
- [ ] Test a video on a phone using mobile data and on a desktop browser.
- [ ] Confirm the gallery plays HLS on Safari/iOS and HLS.js-supported browsers; MP4 fallback is available.
- [ ] Upload only content you own or are licensed/allowed to distribute.

## Monitor Cloudinary usage
1. Sign in to the Cloudinary Console.
2. Open **Settings → Billing** (or the usage/credits view in your console).
3. Review video bandwidth, storage and transformations.
4. Check again after a small test group, then after the first 50–100 viewers.
5. If usage is approaching the allowance, pause promotion and review video lengths, encoding, and plan options before more traffic arrives.

## Rough bandwidth planning for 500 viewers
500 viewers × 5 minutes = 2,500 viewer-minutes = 41.7 hours of playback.

A 1080p stream at an average 4–8 Mbps could use roughly 75–150 GB for that total viewing time. Adaptive streaming may reduce this when viewers are on slower connections or watch at lower resolutions. Actual usage depends on the generated renditions, network conditions, codec, and how much each viewer watches.

Cloudinary's current public pricing page lists 25 monthly credits on Free, 225 on Plus ($99/month monthly billing shown on the pricing page), and credits are shared across storage, transformations and bandwidth. On Free, one credit equals 1 GB of video bandwidth; on self-service paid plans, one credit equals 2 GB of video bandwidth. The full allowance is not necessarily available for bandwidth alone. Verify your own console and current pricing before upgrading.

## Important limits
- This starter uses a simple in-memory login session. For a production site with multiple server instances or frequent restarts, configure a persistent session store before launch.
- Uploads use a normal browser request, not resumable/chunked uploads. For very large files or unstable connections, add chunked upload support.
- The public gallery is intentionally public: anyone with the site link can view and forward it.
