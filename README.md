# AFTERDARK — Cloudinary public highlights

This project gives AFTERDARK:
- A public watch page. Viewers do not need an AFTERDARK account or login.
- Cloudinary video storage and CDN delivery.
- HLS adaptive streaming (up to 1080p by default), which can switch quality based on the viewer's connection.
- Automatically compressed MP4 fallback (`q_auto`, `f_auto`) for browsers without HLS support.
- A password-protected admin upload area.
- A server-side signature endpoint. The Cloudinary API secret is never sent to the browser.

## 1. Set up Cloudinary

1. Create/sign in to a Cloudinary account: https://cloudinary.com/users/register_free
2. Open the Cloudinary Console dashboard.
3. Copy the **Cloud name**, **API Key**, and **API Secret**.
4. Do not paste the API Secret into website HTML, AppDeploy frontend settings, or public chat.
5. This project uploads videos into the `afterdark/highlights` folder. It uses normal public `upload` delivery, so anyone with the AFTERDARK page link can watch them.

## 2. Configure the app

1. Copy `.env.example` to a new file named `.env`.
2. Fill in `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
3. Set `ADMIN_PASSWORD` to a long, unique password.
4. Set `COOKIE_SECURE=true` on an HTTPS deployment.
5. Set a stable random `SESSION_SECRET` (at least 32 random characters) in your hosting environment for production.

Never upload `.env` to a public repository or share it.

## 3. Run locally

Install Node.js 20 or newer, then run:

```bash
npm install
npm start
```

Open `http://localhost:3000`. The public gallery is the home page. Click **Admin** at the bottom to sign in and upload.

## 4. Deploy

Deploy this as a **Node.js web service**, not as a static-only site. The host must support Node.js, environment variables, HTTPS, and persistent session handling (or configure a production session store).

- Build/install command: `npm install`
- Start command: `npm start`
- Environment variables: copy the values from `.env` into the host's environment-variable settings.
- Set `COOKIE_SECURE=true` and a strong `SESSION_SECRET`.
- Use the host's HTTPS public URL as your AFTERDARK share link.

If AppDeploy only accepts static HTML and does not run a Node server, this complete signed-upload version cannot run there by uploading `index.html` alone. Deploy the whole project to a Node-capable host, or ask AppDeploy support whether it supports Node server apps and environment variables. Do not put the Cloudinary API Secret in browser code as a workaround.

## 5. Sharing with viewers

Send the public site URL to your viewers. The gallery is public and requires no sign-in. Anyone who receives the link can forward it; this is link-accessible public viewing, not private/password-protected viewing. Uploaded videos are also publicly deliverable from Cloudinary.

## 6. Video notes

- Upload only highlights you own or are licensed/allowed to distribute.
- Cloudinary plan limits, storage, video transformations, and bandwidth/delivery usage may apply. The Free plan currently includes 25 credits; credits are shared across storage, transformations and bandwidth. Cloudinary currently lists 1 GB video bandwidth per credit on Free and 2 GB per credit on self-service paid plans. Check your Cloudinary Console before sharing widely.
- The gallery loads the latest 100 videos from the `afterdark/highlights` folder.
- The project requests Cloudinary HLS adaptive streaming with `sp_auto` (Cloudinary's default maximum is 1080p) and uses hls.js on browsers without native HLS support. Safari/iOS uses native HLS when available.
- The MP4 fallback uses Cloudinary automatic quality and format selection (`q_auto`, `f_auto`). This reduces delivered file size where supported.
- Adaptive streaming can create derived video renditions and therefore use transformation credits. Cloudinary's documentation says the `sp_auto` stream is processed on first request; monitor the Cloudinary Console after publishing.
- The gallery lists the latest 100 videos. Use the Cloudinary Console's **Settings > Billing / Usage** area to monitor bandwidth, storage and transformations. The app does not claim to show live billing figures inside the admin page.
- If you want custom thumbnails, categories, descriptions, or a larger catalogue, those can be added in a later version.

## Troubleshooting

- **Gallery says it cannot load:** check the Node server logs and Cloudinary credentials; confirm the videos are in `afterdark/highlights` and use public `upload` delivery.
- **Upload says unauthorized:** sign in again; the admin session lasts up to 8 hours.
- **Upload fails:** check Cloudinary's response and account usage/limits; confirm the API key and secret belong to the same Cloudinary environment.
- **Videos over 100 MB:** this starter uses a normal browser upload request. A chunked/resumable upload flow should be added for very large files or unstable connections.


## Match titles, competitions and thumbnails

- The upload form pre-fills the match title from the video filename. Edit it before publishing; the app does not guess teams or match facts from video pixels.
- Select a European domestic league or a UEFA/international competition and optionally enter the home team, away team and match date.
- If no custom thumbnail is uploaded, AFTERDARK generates a thumbnail from approximately the second second of the video.
- Admins can edit a published highlight's title, teams, competition and match date, and replace its thumbnail from the public gallery after signing in.
- Search matches title, home team, away team and competition. The competition selector filters the gallery and works together with search.
- Match details are stored as Cloudinary asset context, so they remain available after Render restarts. Custom thumbnail images are stored in `afterdark/thumbnails`.
- Existing uploads will initially appear with a cleaned-up filename and `Uncategorised`. Sign in as admin, open **Edit details / thumbnail** on each card, and save its match information.

The competition list includes the major European top flights and a broad selection of other UEFA-member domestic leagues, plus UEFA club competitions and international tournaments. League names are editable in the upload and edit forms.
