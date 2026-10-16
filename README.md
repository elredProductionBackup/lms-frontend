# The Professional Network — LMS Frontend

A complete learning-management frontend for the LMS backend, built with **Next.js
(App Router, JSX)**, **Tailwind CSS**, **Redux Toolkit slices**, and **lucide-react**
outlined icons. It ships both the **learner** experience (catalog, player, discussions,
notes) and the **admin / author** console (courses, recordings, subscriptions, members,
join requests, audit log, settings).

The visual design follows the reference screens: warm cream canvas, Playfair Display
serif headings, and teal / gold / purple category tracks.

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
```

The backend base URL is set in `.env.local` (copy `.env.example` to start):

```
NEXT_PUBLIC_API_BASE_URL=https://pretest.elred.io/api/theProfessionalNetwork/lms
API_ORIGIN=https://pretest.elred.io/api/theProfessionalNetwork/lms
```

This is the **server-side proxy target**. The browser never calls it directly — it
calls the same-origin path `/api/theProfessionalNetwork/lms/*`, which `next.config.mjs`
rewrites to the backend. Keeping requests same-origin is what makes the HttpOnly video
stream cookie work (see *Video streaming* below). Change the URL here if it rotates;
everything else works out of the box.

### Signing in
Sign-in is **invite-only**: admins, authors, and learners holding an active seat.
Anyone else gets `403 LOGIN_NOT_ALLOWED` and no account is created.

- **Email code:** enter an email on `/login` → the backend emails a code (in
  non-production it also echoes a `devOtp`, which the UI pre-fills) → verify.
- **Google:** set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local` to the same OAuth
  Web client ID the backend uses (`LMS_GOOGLE_CLIENT_ID`). Add every front-end
  origin (localhost, pretest, prod) to that client's *Authorized JavaScript
  origins*. With the variable empty, the Google button is hidden.

**"Access blocked: Authorization Error · no registered origin · 401 invalid_client"**
comes from Google, not this app: the page's origin isn't on the OAuth client.
In Google Cloud Console → APIs & Services → Credentials → your *Web application*
OAuth client → **Authorized JavaScript origins**, add the exact origin you open
the app on (scheme + host + port, no path, no trailing slash), e.g.
`http://localhost:3000` **and** `http://localhost`, plus each deployed origin.
`127.0.0.1` and `localhost` are different origins. Saving can take a few minutes
to apply. The client ID in `.env.local` must be that client's ID, and the dev
server must be restarted after changing it (`NEXT_PUBLIC_*` is baked in at build).

### Branding & footer
The "Learning" lockup beside the TPN logo is `components/ui/BrandMark.jsx`. Footer
links, contact details and socials live in `src/lib/site.js`; empty values are
hidden.

### Realtime
`hooks/useCourseRealtime.js` connects to the backend's Socket.io at
`/lms-socket.io` with the Bearer token (`handshake.auth.token`), emits
`join:course` on every connect and `leave:course` on exit, and applies
`comment:*` / `question:*` events for the recording on screen. Own posts and
deletes are de-duplicated against their echo. The socket goes straight to the
backend origin (`NEXT_PUBLIC_SOCKET_URL`, else the origin of
`NEXT_PUBLIC_API_BASE_URL`), so the backend must allow this front-end origin in
its Socket.io CORS settings.

### People's display names
One name per person: their profile `name`. An admin can give it only when
their call creates the account: the seat form sends
`POST /subscriptions/:id/seats { email, displayName }`, and `POST /members`
takes `name`. For an existing account the name is ignored (the response's
`user.name` / `name` says which name was kept, and the UI says so). After
that only the person can change it, on Profile; admin screens show names
read-only. Seat lists read `seat.user` (`userExists`, `name`, `avatarUrl`).
Subscriptions have no display name.

### Course access: `unlocked` vs `enrolled`
`unlocked` = the access window is open, so the player works. `enrolled` = on
the course and not removed, so comments, Q&A, notes, bookmarks and live
updates work. Enrolled with the window closed shows "Your access has ended"
on the player and keeps the rest of the page. Not enrolled hides the
discussion tabs. A 403 from stream-session or a heartbeat stops playback and
re-reads the course.

### Thumbnails & posters
The player, module list and session cards try images in order: the module's
own `thumbnailUrl`, then the course cover, then `public/video-poster.svg`
(`components/learner/Poster.jsx`). If one fails to load, the next is used. The
player draws the poster as its own `<img>` rather than `<video poster>`:
the video element carries `crossOrigin="use-credentials"` for the stream
cookie, and Chrome applies that to the poster too, so CDN/S3 images without
CORS headers would otherwise show a black frame.

## Architecture

```
src/
├── app/                      # App Router pages (all .jsx)
│   ├── login, join           # public auth + sign-up
│   ├── home                  # learner catalog (reference img 1 & 2)
│   ├── courses/[id]          # video player + discussions (reference img 3)
│   ├── profile               # edit own profile + avatar
│   └── admin/                # admin/author console (guarded)
│       ├── page              # overview stats
│       ├── courses/[id]      # tabbed course manager
│       ├── members, join-requests, audit-log, settings
├── store/                    # Redux Toolkit
│   ├── index.js              # configureStore
│   └── slices/               # one slice per domain (12 total)
├── lib/                      # api client + formatting helpers
├── components/               # ui / learner / admin / auth
└── hooks/                    # typed redux hooks
```

### State management
Every backend call lives in a `createAsyncThunk` inside a slice, so components stay
declarative and the network layer is centralized. The `src/lib/api.js` client attaches
the bearer token, normalizes errors to `{ code, message, status }`, sends
`credentials: "include"` for the HttpOnly stream cookies, and exposes `mediaUrl()` to
resolve `/media/...` paths against the backend.

### Video streaming
The player (`components/learner/VideoPlayer.jsx`) implements the full streaming flow:
`stream-session` → HLS manifest → periodic `progress` saves → `heartbeat` at the
interval the backend returns → resume prompt from `resumeAtSeconds`. Native HLS is used
on Safari; hls.js elsewhere, both requesting media with credentials so the signed
`stream_<course>_<video>` cookie rides along.

**Same-origin is mandatory.** The stream cookie is HttpOnly and path-scoped, so the
request that sets it (`stream-session`) and the media requests that consume it
(`index.m3u8`, `.ts`, `captions.vtt`) must share one origin. `src/lib/api.js` therefore
uses a same-origin base (`/api/theProfessionalNetwork/lms`) and lets the Next.js rewrite
proxy to the backend — do **not** point the browser at the backend origin directly.

**Captions.** After the session opens, the player fetches the sibling `captions.vtt`
(same signed cookie), and — if a valid WebVTT is returned — exposes a **CC** toggle in
the control bar and renders it as a subtitle track. Videos without captions simply don't
show the toggle. The admin Recordings tab surfaces each video's `captionsStatus`.
Keyboard shortcuts: space/`k` play‑pause, `m` mute, `f` fullscreen, `c` captions,
←/→ seek (forward seeks still respect the no‑skip‑ahead ceiling).

### Session handling & branding
- A replaced/expired session (`401 SESSION_REPLACED`) is caught centrally in
  `src/lib/api.js` and handled once in `providers.jsx`: it clears auth and redirects to
  `/login` with a "signed in elsewhere" message.
- Favicon and app icons live in `public/` (`favicon*.png`, `apple-touch-icon.png`) and
  are declared in `app/layout.jsx`. The header/login logo falls back to `public/tpn.svg`
  when an admin hasn't uploaded a platform logo.

## Endpoint coverage

All 58 documented endpoints are wired into slices:

| Module | Endpoints | Where |
|---|---|---|
| Auth | request-otp, verify-otp, logout, me | `authSlice` · `/login` |
| Profile | get/update/avatar (self + by id) | `profileSlice` · `/profile` |
| Members | add, list, change role, remove | `membersSlice` · `/admin/members` |
| Join requests | list, review, public submit | `joinRequestsSlice` · `/admin/join-requests`, `/join` |
| Settings | public settings, logo upload | `settingsSlice` · `/admin/settings` |
| Courses | list (catalog/manage/public), get, create, update, thumbnail, images, publish, archive, roster | `coursesSlice` · `/home`, `/admin/courses` |
| Subscriptions & Enrollments | create, list w/ seat progress, update, assign/revoke seat, enrollment window | `subscriptionsSlice` · course manager tabs |
| Video streaming | upload, status, rename, delete, stream-session, heartbeat, progress | `videosSlice` · player + Recordings tab |
| Discussions | comments & questions list (with `total`)/add/delete, reply + reply delete, pin | `discussionsSlice` · player sidebar |
| Notes | list/add/update/delete | `notesSlice` · player sidebar |
| Admin & Audit | overview, audit log, distinct actions | `adminSlice` · `/admin`, `/admin/audit-log` |

## Roles

- **Learner** — catalog, player, discussions, private notes, profile.
- **Author** — everything a learner has, plus a console scoped to their own courses
  (create, edit, recordings, roster, enrollment windows, replies to questions).
- **Admin** — full console: all courses, members, join requests, subscriptions/seats,
  audit log, and platform settings.

Route access is enforced by `components/auth/RouteGuard.jsx`.

## Notes & known backend behaviors reflected in the UI

- The backend has no course "category" field, so the teal/gold/purple **tracks** are
  derived deterministically from the course id to match the reference cards. Set a
  `track` field on a course to override.
- `durationSeconds` / `hlsPath` are never written by the backend, so durations show as
  "pending" until known and the player relies on the media element's own metadata.
- Cross-origin `SameSite=Lax` stream cookies: if segment requests are blocked by the
  browser because the frontend and backend are different origins, run the frontend
  behind a proxy that shares the backend origin, or serve both from the same host.
