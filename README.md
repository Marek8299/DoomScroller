# DoomScroller

A small TikTok-style clone: Angular feed/upload UI, an ASP.NET Core API, and ffmpeg doing
the video transcoding in a background worker.

```
DoomScroller/
├── backend/DoomScroller.Api/   ASP.NET Core 10 Web API (EF Core 10)
└── doomscroller-frontend/      Angular 22 app (zoneless, signals)
```

> **Note on "Angular.js"**: AngularJS (1.x) has been end-of-life since 2022, so this was
> built with current Angular (v22: standalone, zoneless, signals) instead — same name, current
> framework. Say the word if you actually need the legacy AngularJS.

## 1. Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) 22.22.3+ or 24.15+ (Angular 22's CLI refuses older builds) and npm
- `ffmpeg` and `ffprobe` on your `PATH` — for the "conservative" preset's hardware path,
  build/obtain ffmpeg with `--enable-nvenc` (NVIDIA) or `--enable-amf` (AMD); otherwise it
  transparently falls back to software `libx265`.

## 2. Run the backend

```bash
cd backend/DoomScroller.Api
dotnet restore
dotnet run
```

Listens on `http://localhost:5080` (see `appsettings.json`). The OpenAPI document is at
`http://localhost:5080/openapi/v1.json` in development (built-in `AddOpenApi`, no Swashbuckle). Uploaded originals land in
`Storage/uploads/`, transcoded renditions in `Storage/media/` (served at `/media/...`).

## 3. Run the frontend

```bash
cd doomscroller-frontend
npm install
npm start
```

Opens on `http://localhost:4200` and talks to the API at `http://localhost:5080/api`
(`src/environments/environment.ts`). CORS for that origin is already allowed on the backend.

**Player controls** (`feed/video-player.*`): the browser's native controls are off. Tap a video
to pause/resume. A column of round buttons on the right edge (thumb-reachable) holds like and mute;
mute state is shared by the whole feed (`PlaybackPreferences`), so unmuting once carries over to
the next videos. The
progress bar along the bottom can be tapped, dragged, or driven with the arrow keys / Home / End.
Videos always start muted after a page load because browsers block unmuted autoplay until the
user has interacted with the page. Run the frontend tests with `npm test`.

## 4. Using a custom-built ffmpeg (e.g. faster than distro-packaged)

`FfmpegPath`/`FfprobePath` in `appsettings.json` (or `FFMPEG__FFMPEGPATH` /
`FFMPEG__FFPROBEPATH` env vars) point the backend at a specific binary. Leave them blank
and it just calls `ffmpeg`/`ffprobe` from `PATH` - so this is entirely optional, but useful
if, say, your distro's apt build of ffmpeg is a conservative one and you want something
closer to a hand-tuned build (NVENC/VAAPI enabled, more codec libs, etc.).

`make ffmpeg-custom` (Makefile at the repo root) builds one for you:

```bash
make ffmpeg-deps      # apt-installs the dev headers/libs configure will look for (optional codecs
                       # not installed are simply skipped, no need to install everything)
make ffmpeg-custom     # clones the latest ffmpeg source into ffmpeg.tmp/, builds it with clang,
                       # installs to tools/ffmpeg/, then deletes ffmpeg.tmp/
```

It auto-detects which optional codec libs are present via `pkg-config` and only passes the
matching `--enable-X` flags, so it won't hard-fail just because you skipped a library. NVENC
needs `nv-codec-headers` (see the hint `ffmpeg-deps` prints - a driver still needs to be
installed separately for it to actually run) and AMD AMF needs its headers vendored into
`ffmpeg.tmp/AMF` before configure runs (also printed by `ffmpeg-deps`). Once it finishes:

```json
"Ffmpeg": {
  "FfmpegPath": "/absolute/path/to/DoomScroller/tools/ffmpeg/bin/ffmpeg",
  "FfprobePath": "/absolute/path/to/DoomScroller/tools/ffmpeg/bin/ffprobe"
}
```

(and put `tools/ffmpeg/lib` on `LD_LIBRARY_PATH` if it built with `--enable-shared`, which
is the default here).

## 5. Database (SQLite or MySQL)

Picked via config, standard ASP.NET Core style — `appsettings.json`, overridable with the
usual double-underscore env var convention (no separate `.env` file/package needed; that's
just how ASP.NET Core's built-in configuration already works):

```json
"Database": {
  "Provider": "Sqlite",                          // or "MySql"
  "SqlitePath": "Storage/doomscroller.db",        // only used for Sqlite; relative to the app,
                                                   // not the shell's current directory
  "MySqlServerVersion": "8.0.36"                  // pins the version dotnet-ef assumes so it
},                                                 // doesn't need a live server just to add a
                                                   // migration - set to "auto" to detect instead
"ConnectionStrings": {
  "MySql": "Server=localhost;Port=3306;Database=doomscroller;User=doomscroller;Password=changeme;"
}
```

or via env vars: `DATABASE__PROVIDER=MySql`, `CONNECTIONSTRINGS__MYSQL=...`, etc.

> **MySQL provider note**: the official Pomelo provider has no EF Core 10 release yet (its
> last release is 9.0.0), so the project references the community fork
> `Microting.EntityFrameworkCore.MySql` 10.x, which is the maintained EF Core 10
> continuation with the same `UseMySql()` API. If you'd rather stay on the official
> provider, the alternative is EF Core 9 + Pomelo 9.0.0 (it runs fine on net10.0) — swap the
> package references and the EF `10.0.*` versions in `DoomScroller.Api.csproj`.

The app applies any pending migrations automatically on startup (`db.Database.Migrate()`
in `Program.cs`) — fine for local dev; for a real deployment you'd more likely run
`dotnet ef database update` as its own release step instead of migrating on every boot.

### Migrations

EF Core ties migrations to a concrete `DbContext` type, so — per Microsoft's own guidance
for supporting more than one provider off a single model — there's a thin subclass per
provider (`SqliteDoomScrollerDbContext`, `MySqlDoomScrollerDbContext`, both in
`Data/DoomScrollerDbContext.cs`) and a separate migrations folder for each:

```
backend/DoomScroller.Api/Migrations/
├── Sqlite/  (InitialCreate.cs, .Designer.cs, SqliteDoomScrollerDbContextModelSnapshot.cs)
└── MySql/   (InitialCreate.cs, .Designer.cs, MySqlDoomScrollerDbContextModelSnapshot.cs)
```

SQLite note: its EF provider can't `ORDER BY` a `DateTimeOffset` column, so on SQLite only
the upload timestamp is stored as UTC ticks in an `INTEGER` column (value converter in
`SqliteDoomScrollerDbContext`); MySQL keeps a native `datetime(6)`.

Since EF Core 9, `Migrate()` throws when the model doesn't match the last snapshot. Because
the initial migrations are hand-written, `Program.cs` currently ignores that check
(`PendingModelChangesWarning`) — remove the two `ConfigureWarnings(...)` calls after
regenerating for real.

**Honesty note**: this sandbox couldn't reach `api.nuget.org` to actually run the
`dotnet ef` CLI while building this, so the `InitialCreate` migrations above were
hand-authored to match the entity model rather than tool-generated — the schema they
create is correct, but if `dotnet ef migrations add` ever complains about "pending model
changes" that don't seem real, that's why. One command replaces them with the real thing:

```bash
make migrations-sqlite   # or:
make migrations-mysql
```

(both install the `dotnet-ef` global tool first if it's missing). Adding a *new* migration
later, once the initial one is verified, is the normal:

```bash
cd backend/DoomScroller.Api
dotnet ef migrations add SomeChange --context SqliteDoomScrollerDbContext --output-dir Migrations/Sqlite --namespace DoomScroller.Api.Migrations.Sqlite
dotnet ef migrations add SomeChange --context MySqlDoomScrollerDbContext  --output-dir Migrations/MySql  --namespace DoomScroller.Api.Migrations.MySql
```

## 6. Encoding configuration (server admin only)

Uploaders only provide a **file, a name and an optional description**. *How* videos get
encoded is the admin's call, in the `Conversion` section of `appsettings.json` (or env vars
like `CONVERSION__PRESET=Conservative`). Each upload snapshots the settings in force at the
time, so changing them later never rewrites already-processed videos. Invalid values (unknown
preset, malformed resolution list) stop the app at startup rather than failing mid-encode.

```json
"Conversion": {
  "Preset": "WebOptimized",
  "Container": "Mp4",
  "ForceCopyAudioIfSupported": true,
  "ResolutionTargets": "original"
}
```

They're turned into an ffmpeg command per rendition by `FfmpegService.BuildFfmpegArgs`
(`backend/DoomScroller.Api/Services/FfmpegService.cs`):

| Setting | Values | Effect |
|---|---|---|
| **Preset** | `LowestSize` | AV1 video (`libsvtav1`, CRF 35), AAC audio. Smallest files, slowest encode, needs a modern decoder. |
| | `Conservative` | HEVC video. Uses `hevc_nvenc` (NVIDIA) or `hevc_amf` (AMD) if `ffmpeg -encoders` reports them at startup, else software `libx265` (CRF 26). |
| | `WebOptimized` | H.264 (`libx264`, CRF 23, `veryfast`), AAC audio, `+faststart` on MP4 so playback can start before the file finishes downloading. |
| **Container** | `Mp4` / `Mkv` | Sets the output extension and ffmpeg muxer (`mp4` / `matroska`). `+faststart` only applies to MP4. |
| **ForceCopyAudioIfSupported** | `true` / `false` | When on *and* the source audio codec is `aac`, `mp3`, or `opus`, audio is stream-copied (`-c:a copy`) instead of re-encoded. **WMA is never copied** — it's always re-encoded to AAC regardless (`ConversionOptions.CanCopyAudioCodec`). When off, audio is always re-encoded to AAC. |
| **ResolutionTargets** | `"original"` | One rendition at the source resolution. |
| | `"480,720,1080,2160"` (or any comma list) | One rendition per listed height that is `<=` the source height (never upscales). Scaling uses `scale=-2:H` to preserve aspect ratio with an even width. |

The video is probed with `ffprobe` first (`FfmpegService.ProbeAsync`) to get the source
width/height/codecs, which is what the resolution-target and audio-copy logic checks against.

Uploads return immediately (`202 Accepted`) with `status: Queued`; a `BackgroundService`
(`VideoProcessingWorker`) pulls jobs off an in-process channel and runs ffmpeg outside the
HTTP request. The feed polls `GET /api/videos` every 8s until renditions flip to `Ready`.

### Volume normalisation (uploader's choice)

Unlike the settings above, loudness is an artistic decision, so it's a checkbox on the upload
form (`normalizeVolume`) rather than server config. When ticked, audio is normalised to
**-16 LUFS** (true peak -1.5 dB) with ffmpeg's `loudnorm` filter in two passes: one analysis pass
over the source audio (once per video), then every rendition applies the same measured linear
gain, so quiet clips get louder without being compressed. Because the audio is filtered it is
always re-encoded to AAC (at 48 kHz), even if `ForceCopyAudioIfSupported` is on. Videos without
an audio track are left alone. Tested on a clip at -59.8 LUFS, which came out at -16.0 LUFS.
Targets are constants in `Services/LoudnessNormalization.cs`.

### Perceptual hash (for spotting duplicates later)

While processing, the worker computes a perceptual hash of the **source** video
(`PerceptualHash` + `VideoFingerprintService`), stored in `Videos.PerceptualHash`
(server-side only, never returned by the API). It is 16 frames sampled at evenly spaced
moments (the middle of 16 equal slices of the duration); each frame is squashed to 32x32
grayscale, DCT-transformed, and the 8x8 lowest-frequency block is thresholded against its
median, giving 64 bits per frame, written as 16 hex chars. 256 hex chars in total.

Unlike a file hash it survives re-encoding, resizing and codec changes. Measured on a test
clip: a re-encoded, half-size HEVC copy differed from the original by 4 of 1024 bits, an
unrelated video by 492. Comparing two videos is the Hamming distance (popcount of the XOR)
summed over the 16 frame hashes. **No duplicate detection is done yet** - the hash is only
recorded. Hashing failures are logged and leave the column null without failing the video.

## 7. API surface

Auth (cookie session, see section 8):
- `POST /api/auth/register` `{username, password}` — creates the account and signs in.
- `POST /api/auth/login` `{username, password}` — signs in. `POST /api/auth/logout`.
- `GET /api/auth/me` — the signed-in user, or 401. The SPA calls it on startup.

Videos:
- `POST /api/videos` — **requires sign-in.** Multipart upload: `file`, `title` (max 200, defaults
  to the file name), `description` (optional, max 2000), `normalizeVolume` (optional bool).
- `GET /api/videos?skip=&take=` — feed of ready videos from everyone, newest first.
- `GET /api/videos/{id}` — one video. Unfinished videos are only visible to their author (404 for
  everyone else).
- `GET /api/videos/{id}/comments?skip=&take=` — a video's comments, newest first (default 20, max
  50). Public. `canDelete` tells the viewer whether they may remove each one.
- `POST /api/videos/{id}/comments` `{text}` — **requires sign-in.** Max 500 characters; limited to
  20 per minute per user (429 beyond that). Returns 201 and the new comment.
- `DELETE /api/videos/{id}/comments/{commentId}` — **requires sign-in.** Allowed for the comment's
  author and for the author of the video (403 for anyone else, 404 if it's gone).
- `PUT /api/videos/{id}/like` / `DELETE /api/videos/{id}/like` — **require sign-in.** Like / remove
  your like; both idempotent. Return `{likeCount, liked}`. Only finished videos can be liked
  (404 otherwise).

Authors:
- `GET /api/users/{username}` — `{username, createdAtUtc, videoCount, likeCount}` (likes received
  across their finished videos).
- `GET /api/users/{username}/videos?skip=&take=` — that author's videos, newest first. Visitors
  see finished videos; the author also sees their own queued/processing/failed uploads.

`GET /media/{renditionId}.{ext}` — static file serving of a transcoded rendition.

Responses are DTOs (`Contracts/`), never entities, so nothing like a password hash or a server
file path can leak.

## 8. Accounts and authentication

- **Who can do what**: anyone can watch and browse author pages; **only signed-in users can upload**.
  Registration is open (username + password). Each video records its author, shown on the feed as
  `@username` linking to `/u/username`, which is the same scrolling feed filtered to that author.
- **Sessions**: ASP.NET Core cookie authentication (no extra packages). The cookie is `HttpOnly`
  (JavaScript can't read it, unlike a token in localStorage) and `SameSite=Lax` (other sites can't
  make the browser send it on cross-site POSTs, which is the CSRF defence here). The API answers
  401/403 instead of redirecting. Cross-origin dev setups work because CORS allows credentials for
  `http://localhost:4200` and the Angular app sends the cookie to the API (`credentialsInterceptor`).
  Use `localhost` consistently (not `127.0.0.1` in one place) or the browser will treat them as
  different sites.
- **Production**: serve over HTTPS. The cookie is marked `Secure` whenever the request arrived over
  HTTPS; behind a TLS-terminating proxy, forward the original scheme (`UseForwardedHeaders`) so the
  app can tell. If the frontend and API end up on different *sites*, `SameSite` would need to
  change and you'd want real CSRF tokens.
- **Passwords**: hashed with ASP.NET's `PasswordHasher` (PBKDF2, per-user salt), upgraded
  transparently on login when defaults get stronger. 8-128 characters. Usernames are 3-30 letters,
  digits or underscores, unique case-insensitively (`Marek` and `marek` are the same account).
  Rules live in `Auth/CredentialRules.cs`.
- **Abuse limits**: login and register share a per-IP limit of 10 requests/minute (429 beyond
  that). Wrong password and unknown user return the same error after the same amount of work, so
  usernames can't be probed.
- **Existing videos** uploaded before accounts existed have no author (`AuthorId` is nullable);
  they still show in the feed, just without an `@name`.
- **Not built yet**: email / password reset, account deletion, roles or moderation, invite-only
  registration. Say if you want any of them.

## 9. Likes

Every video in the API carries `likeCount`, `likedByMe` and `commentCount` (always false when signed out). Likes
live in a `VideoLikes` table whose primary key is `(VideoId, UserId)`, so one user can't like a
video twice, however many requests race. The database enforces that, not just the code. Counts are
computed from that table instead of being stored on the video, so they can't drift or lose
increments under concurrency; a page of videos costs two extra queries in total, not two per video.
Likes disappear with their video or user (cascade).

In the UI the heart updates instantly and rolls back if the server refuses; taps while a request
is in flight are ignored so a double-tap can't desync the count. Signed-out visitors who tap it go
to the login page and come back afterwards; a session that expired mid-visit is handled the same way.

Not built yet: a "videos I liked" page, double-tap-to-like on the video, comments.

## 10. Comments

Flat comments (no reply threads), newest first, 500 characters max (`Services/CommentRules.cs`:
trimmed, line endings unified, runs of blank lines collapsed). Only finished videos have comments,
like everything else about unfinished ones.

- **Who can do what**: anyone can read; signed-in users can post; a comment can be deleted by its
  author **or by the author of the video it's on** (the minimum moderation a social app needs:
  you can clean up your own comment section).
- **Spam**: posting is rate-limited per signed-in user (20/minute), not per IP, so one account can't
  flood a video and people sharing a network don't throttle each other. This needs authentication
  to run before the rate limiter, which is the middleware order in `Program.cs`.
- **Counts**: `commentCount` is computed from the table, batched per page of videos like the likes
  (the new `VideoPresenter` assembles a video with its like info and comment count, so controllers
  don't each repeat that).
- **Storage**: `VideoComments`, indexed on `(VideoId, CreatedAtUtc)` for "newest comments of this
  video"; comments cascade away with their video or author.
- **UI**: the speech-bubble button in the action column opens a bottom sheet over the video (the
  video keeps playing above it). Enter posts, Shift+Enter adds a line, Escape closes, "Load more"
  pages through older ones. Posting is a send-icon button. Deleting asks first: "Delete this comment?"
  appears inline under the comment with Cancel focused (so a stray Enter can't delete it), and Escape
  backs out of the question before it would close the panel. After confirming, the comment disappears
  at once and comes back if the server refuses; a failed post keeps what you typed.

Not built yet: replies/threads, editing, likes on comments, reporting, mentions, notifications.

## 11. Known corners cut for "small clone" scope

- No likes/comments or thumbnails — the feed just autoplays each rendition's `<video>` tag.
- No CDN/streaming protocol (HLS/DASH) — renditions are plain progressive MP4/MKV files;
  fine for a demo, not for real scale.
