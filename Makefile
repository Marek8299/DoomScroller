# DoomScroller build helpers.
#
# `make ffmpeg-custom` builds ffmpeg from the latest source with clang and installs it
# under tools/ffmpeg/, instead of relying on whatever apt shipped (which is usually built
# conservatively and leaves real performance - hardware encoders especially - on the table).
#
# Point the backend at the result via appsettings.json:
#   "Ffmpeg": { "FfmpegPath": "/absolute/path/to/tools/ffmpeg/bin/ffmpeg",
#               "FfprobePath": "/absolute/path/to/tools/ffmpeg/bin/ffprobe" }
# or the equivalent env vars: FFMPEG__FFMPEGPATH / FFMPEG__FFPROBEPATH.

FFMPEG_TMP_DIR      := ffmpeg.tmp
FFMPEG_INSTALL_DIR  := $(CURDIR)/tools/ffmpeg
FFMPEG_GIT_URL      := https://git.ffmpeg.org/ffmpeg.git
FFMPEG_JOBS         := $(shell nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

CC  := clang
CXX := clang++

# --- Optional codec libs: only pass --enable-X to configure when pkg-config can actually
# --- see it, so this doesn't hard-fail on a machine that skipped `make ffmpeg-deps` or
# --- only wants a subset. Run `make ffmpeg-deps` first for the full feature set.
define HAVE_PKG
$(shell pkg-config --exists $(1) 2>/dev/null && echo yes)
endef

FFMPEG_FEATURES :=

ifeq ($(call HAVE_PKG,x264),yes)
  FFMPEG_FEATURES += --enable-libx264
endif
ifeq ($(call HAVE_PKG,x265),yes)
  FFMPEG_FEATURES += --enable-libx265
endif
ifeq ($(call HAVE_PKG,vpx),yes)
  FFMPEG_FEATURES += --enable-libvpx
endif
ifeq ($(call HAVE_PKG,aom),yes)
  FFMPEG_FEATURES += --enable-libaom
endif
ifeq ($(call HAVE_PKG,SvtAv1Enc),yes)
  FFMPEG_FEATURES += --enable-libsvtav1
endif
ifeq ($(call HAVE_PKG,dav1d),yes)
  FFMPEG_FEATURES += --enable-libdav1d
endif
ifeq ($(call HAVE_PKG,opus),yes)
  FFMPEG_FEATURES += --enable-libopus
endif
ifeq ($(call HAVE_PKG,mp3lame),yes)
  FFMPEG_FEATURES += --enable-libmp3lame
endif
ifeq ($(call HAVE_PKG,fdk-aac),yes)
  FFMPEG_FEATURES += --enable-libfdk-aac --enable-nonfree
endif
ifeq ($(call HAVE_PKG,vorbis),yes)
  FFMPEG_FEATURES += --enable-libvorbis
endif
ifeq ($(call HAVE_PKG,theora),yes)
  FFMPEG_FEATURES += --enable-libtheora
endif
ifeq ($(call HAVE_PKG,webp),yes)
  FFMPEG_FEATURES += --enable-libwebp
endif
ifeq ($(call HAVE_PKG,ass),yes)
  FFMPEG_FEATURES += --enable-libass
endif
ifeq ($(call HAVE_PKG,freetype2),yes)
  FFMPEG_FEATURES += --enable-libfreetype
endif
ifeq ($(call HAVE_PKG,fribidi),yes)
  FFMPEG_FEATURES += --enable-libfribidi
endif
ifeq ($(call HAVE_PKG,soxr),yes)
  FFMPEG_FEATURES += --enable-libsoxr
endif
ifeq ($(call HAVE_PKG,gnutls),yes)
  FFMPEG_FEATURES += --enable-gnutls
endif

# NVENC/NVDEC/CUVID only need the nv-codec-headers (ffnvcodec.pc) + a working NVIDIA
# driver at runtime, not the full CUDA toolkit, so this checks for the headers rather
# than for nvcc.
ifeq ($(call HAVE_PKG,ffnvcodec),yes)
  FFMPEG_FEATURES += --enable-cuvid --enable-nvdec --enable-nvenc --enable-nonfree
endif

# AMD AMF is source-drop-in (no pkg-config module); enable it when the headers were
# vendored under $(FFMPEG_TMP_DIR)/AMF - see the `amf-headers` hint in ffmpeg-deps.
ifneq ("$(wildcard $(FFMPEG_TMP_DIR)/AMF)","")
  FFMPEG_FEATURES += --enable-amf
endif

# VAAPI (Intel/AMD hardware accel on Linux) needs no special lib beyond libva-dev.
ifeq ($(call HAVE_PKG,libva),yes)
  FFMPEG_FEATURES += --enable-vaapi
endif

.PHONY: ffmpeg-deps ffmpeg-custom ffmpeg-clean

## Installs the dev headers/libraries the configure flags above look for. Optional -
## ffmpeg-custom will just skip whatever isn't present. Re-run after installing more
## codec libs to pick them up on the next build.
ffmpeg-deps:
	sudo apt-get update
	sudo apt-get install -y \
		autoconf automake build-essential clang cmake git-core \
		libaom-dev libass-dev libdav1d-dev libfdk-aac-dev libfreetype6-dev \
		libfribidi-dev libgnutls28-dev libmp3lame-dev libnuma-dev libopus-dev \
		libsoxr-dev libsvtav1-dev libtheora-dev libtool libva-dev libvdpau-dev \
		libvorbis-dev libvpx-dev libwebp-dev libx264-dev libx265-dev \
		libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev meson nasm ninja-build \
		pkg-config texinfo yasm zlib1g-dev
	@echo ""
	@echo "NVENC support needs nv-codec-headers too (not packaged by apt on most distros):"
	@echo "  git clone https://github.com/FFmpeg/nv-codec-headers.git nv-codec-headers.tmp"
	@echo "  sudo make -C nv-codec-headers.tmp install"
	@echo "  rm -rf nv-codec-headers.tmp"
	@echo ""
	@echo "AMD AMF support needs the AMF headers vendored into $(FFMPEG_TMP_DIR)/AMF"
	@echo "before 'make ffmpeg-custom' runs configure, e.g.:"
	@echo "  git clone --depth 1 https://github.com/GPUOpen-LibrariesAndSDKs/AMF.git amf.tmp"
	@echo "  mkdir -p $(FFMPEG_TMP_DIR) && cp -r amf.tmp/amf/public/include $(FFMPEG_TMP_DIR)/AMF && rm -rf amf.tmp"

## Clones the latest ffmpeg source into ffmpeg.tmp/, builds it with clang using whatever
## optional codec libs are detected, installs to tools/ffmpeg/, then deletes ffmpeg.tmp/.
ffmpeg-custom:
	@command -v $(CC) >/dev/null 2>&1 || { echo "clang not found - install it or set CC="; exit 1; }
	@echo "==> Cloning latest ffmpeg into $(FFMPEG_TMP_DIR)"
	rm -rf $(FFMPEG_TMP_DIR)
	git clone --depth 1 $(FFMPEG_GIT_URL) $(FFMPEG_TMP_DIR)
	@echo "==> Detected optional features: $(FFMPEG_FEATURES)"
	@echo "==> Configuring (prefix: $(FFMPEG_INSTALL_DIR))"
	cd $(FFMPEG_TMP_DIR) && CC=$(CC) CXX=$(CXX) ./configure \
		--prefix=$(FFMPEG_INSTALL_DIR) \
		--cc=$(CC) --cxx=$(CXX) \
		--enable-gpl --enable-version3 --enable-pthreads \
		--disable-static --enable-shared \
		$(FFMPEG_FEATURES)
	@echo "==> Building with $(FFMPEG_JOBS) parallel jobs (this takes a while)"
	$(MAKE) -C $(FFMPEG_TMP_DIR) -j$(FFMPEG_JOBS)
	@echo "==> Installing to $(FFMPEG_INSTALL_DIR)"
	$(MAKE) -C $(FFMPEG_TMP_DIR) install
	@echo "==> Cleaning up $(FFMPEG_TMP_DIR)"
	rm -rf $(FFMPEG_TMP_DIR)
	@echo ""
	@echo "Done. Binaries at:"
	@echo "  $(FFMPEG_INSTALL_DIR)/bin/ffmpeg"
	@echo "  $(FFMPEG_INSTALL_DIR)/bin/ffprobe"
	@echo ""
	@echo "Point the backend at them in backend/DoomScroller.Api/appsettings.json:"
	@echo '  "Ffmpeg": { "FfmpegPath": "$(FFMPEG_INSTALL_DIR)/bin/ffmpeg", "FfprobePath": "$(FFMPEG_INSTALL_DIR)/bin/ffprobe" }'
	@echo "or export FFMPEG__FFMPEGPATH / FFMPEG__FFPROBEPATH before 'dotnet run'."
	@echo "If it's built with --enable-shared, also make sure $(FFMPEG_INSTALL_DIR)/lib is on LD_LIBRARY_PATH."

## Just removes the temp checkout, e.g. after a failed/aborted build.
ffmpeg-clean:
	rm -rf $(FFMPEG_TMP_DIR)

# --- Database migrations ---------------------------------------------------------
#
# The repo ships hand-authored initial migrations under backend/DoomScroller.Api/Migrations/
# {Sqlite,MySql}/ (this sandbox couldn't reach api.nuget.org to run the real `dotnet ef`
# tool while building this). They create the right schema, but if `dotnet ef` ever
# complains about "pending model changes" that don't match reality, regenerate for real
# with the targets below - that's the authoritative source of truth going forward.

API_DIR := backend/DoomScroller.Api

.PHONY: ef-tools migrations-sqlite migrations-mysql migrations-clean

## One-time: installs the dotnet-ef CLI tool (needs NuGet access).
ef-tools:
	dotnet tool install --global dotnet-ef || dotnet tool update --global dotnet-ef

## Regenerates the SQLite initial migration for real, replacing the hand-authored one.
migrations-sqlite: ef-tools
	rm -rf $(API_DIR)/Migrations/Sqlite
	cd $(API_DIR) && dotnet ef migrations add InitialCreate \
		--context SqliteDoomScrollerDbContext \
		--output-dir Migrations/Sqlite \
		--namespace DoomScroller.Api.Migrations.Sqlite

## Regenerates the MySQL initial migration for real, replacing the hand-authored one.
## Needs ConnectionStrings:MySql to point at a real reachable server unless
## Database:MySqlServerVersion is set to a fixed version in appsettings.json.
migrations-mysql: ef-tools
	rm -rf $(API_DIR)/Migrations/MySql
	cd $(API_DIR) && dotnet ef migrations add InitialCreate \
		--context MySqlDoomScrollerDbContext \
		--output-dir Migrations/MySql \
		--namespace DoomScroller.Api.Migrations.MySql

## Deletes both migration sets - use before regenerating from scratch.
migrations-clean:
	rm -rf $(API_DIR)/Migrations/Sqlite $(API_DIR)/Migrations/MySql
