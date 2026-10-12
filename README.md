# DoomScroller

A small TikTok-style clone: Angular feed/upload UI, an ASP.NET Core API, and ffmpeg doing
the video transcoding in a background worker.

```
DoomScroller/
├── backend/DoomScroller.Api/   ASP.NET Core 8 Web API
└── doomscroller-frontend/      Angular 19 app
```

> **Note on "Angular.js"**: AngularJS (1.x) has been end-of-life since 2022, so this was
> built with modern Angular (standalone components, v19) instead — same name, current
> framework. Say the word if you actually need the legacy AngularJS.

## 1. Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 20+](https://nodejs.org/) and npm
- `ffmpeg` and `ffprobe` on your `PATH` — for the "conservative" preset's hardware path,
  build/obtain ffmpeg with `--enable-nvenc` (NVIDIA) or `--enable-amf` (AMD); otherwise it
  transparently falls back to software `libx265`.

## 2. Run the backend

```bash
cd backend/DoomScroller.Api
dotnet restore
dotnet run
```

Listens on `http://localhost:5080` (see `appsettings.json`). Swagger UI is at
`http://localhost:5080/swagger` in development. Uploaded originals land in
`Storage/uploads/`, transcoded renditions in `Storage/media/` (served at `/media/...`).

## 3. Run the frontend

```bash
cd doomscroller-frontend
npm install
npm start
```

Opens on `http://localhost:4200` and talks to the API at `http://localhost:5080/api`
(`src/environments/environment.ts`). CORS for that origin is already allowed on the backend.

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

## 5. How the configuration options work

Everything is submitted with the upload as multipart form fields and turned into an
ffmpeg command per rendition by `FfmpegService.BuildFfmpegArgs` (see
`backend/DoomScroller.Api/Services/FfmpegService.cs`):

| Option | Values | Effect |
|---|---|---|
| **Encoding preset** | `LowestSize` | AV1 video (`libsvtav1`, CRF 35), AAC audio. Smallest files, slowest encode, needs a modern decoder. |
| | `Conservative` | HEVC video. Uses `hevc_nvenc` (NVIDIA) or `hevc_amf` (AMD) if `ffmpeg -encoders` reports them at startup, else software `libx265` (CRF 26). |
| | `WebOptimized` | H.264 (`libx264`, CRF 23, `veryfast`), AAC audio, `+faststart` on MP4 so playback can start before the file finishes downloading. |
| **Container** | `Mp4` / `Mkv` | Sets the output extension and ffmpeg muxer (`mp4` / `matroska`). `+faststart` only applies to MP4. |
| **Force copy audio** | on/off | When on *and* the source audio codec is `aac`, `mp3`, or `opus`, audio is stream-copied (`-c:a copy`) instead of re-encoded. **WMA is never copied** — it's always re-encoded to AAC regardless of this flag (`ConversionOptions.CanCopyAudioCodec`). When off, audio is always re-encoded to AAC. |
| **Resolution targets** | `original` | One rendition at the source resolution. |
| | `480,720,1080,2160` (or any custom comma list) | One rendition per listed height that is `<=` the source height (never upscales). Scaling uses `scale=-2:H` to preserve aspect ratio with an even width. |

The video is probed with `ffprobe` first (`FfmpegService.ProbeAsync`) to get the source
width/height/codecs, which is what the resolution-target and audio-copy logic checks against.

Uploads return immediately (`202 Accepted`) with `status: Queued`; a `BackgroundService`
(`VideoProcessingWorker`) pulls jobs off an in-process channel and runs ffmpeg outside the
HTTP request. The frontend polls `GET /api/videos/{id}` (feed polls `GET /api/videos` every
8s) until renditions flip to `Ready`.

## 6. API surface

- `POST /api/videos` — multipart upload: `file`, `title`, `preset`, `container`,
  `forceCopyAudioIfSupported`, `resolutionTargets`.
- `GET /api/videos?skip=&take=` — feed of ready videos, newest first.
- `GET /api/videos/{id}` — single video + rendition status (for polling).
- `GET /api/config/options` — preset/container/resolution choices, so the Angular form is
  driven by the backend instead of a second hard-coded copy.
- `GET /media/{renditionId}.{ext}` — static file serving of a transcoded rendition.

## 7. Known corners cut for "small clone" scope

- Video storage is an in-memory repository (`InMemoryVideoRepository`) — restarting the API
  loses the catalog. Swap in EF Core + a real database when this needs to survive a restart.
- No auth/accounts, no likes/comments, no thumbnails — the feed just autoplays each
  rendition's `<video>` tag.
- No CDN/streaming protocol (HLS/DASH) — renditions are plain progressive MP4/MKV files;
  fine for a demo, not for real scale.
