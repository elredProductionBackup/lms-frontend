"use client";

import {
  useEffect, useRef, useState, useCallback,
  forwardRef, useImperativeHandle,
} from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Lock, Loader2,
  Gauge, Bookmark, BookmarkPlus, Trash2, Captions, CaptionsOff,
  RotateCcw, RotateCw, RectangleHorizontal,
} from "lucide-react";
import { useAppDispatch } from "@/hooks/redux";
import {
  startStreamSession,
  streamHeartbeat,
  saveProgress,
} from "@/store/slices/videosSlice";
import { clock } from "@/lib/format";

// Available playback speeds. Speed can be changed freely — only *seeking ahead*
// is restricted (see the max-watched guard below).
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// A seek is treated as "skipping ahead" only if it lands more than this many
// seconds past the furthest point already watched.
const SEEK_TOLERANCE = 1;

// Arrow-key nudge (±5s) and the ⟲/⟳ button + J/L jump (±10s). The 10s rewind is
// the headline control: one tap to re-watch the bit you just heard.
const SEEK_STEP = 5;
const SKIP_STEP = 10;

// If the learner ignores the resume prompt, dismiss it on its own after this
// many seconds. Hovering the prompt pauses the countdown (desktop), and it
// also clears the moment playback starts. Tune freely.
const RESUME_PROMPT_SECONDS = 8;

const CAPTIONS_PREF_KEY = "lms.captions.on";
const bookmarksKey = (videoId) => `lms.bookmarks.${videoId}`;

function loadCaptionPref() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CAPTIONS_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function persistCaptionPref(on) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAPTIONS_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function loadBookmarks(videoId) {
  if (typeof window === "undefined" || !videoId) return [];
  try {
    const raw = window.localStorage.getItem(bookmarksKey(videoId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistBookmarks(videoId, list) {
  if (typeof window === "undefined" || !videoId) return;
  try {
    window.localStorage.setItem(bookmarksKey(videoId), JSON.stringify(list));
  } catch {
    /* storage full / disabled — bookmarks just won't persist */
  }
}

// Derive the sibling captions URL from a manifest URL:
//   .../stream/<course>/<video>/index.m3u8  ->  .../stream/<course>/<video>/captions.vtt
function captionsUrlFromManifest(manifestUrl) {
  if (!manifestUrl) return null;
  return manifestUrl.replace(/[^/?#]*\.m3u8(\?[^#]*)?(#.*)?$/i, "captions.vtt");
}

const VideoPlayer = forwardRef(function VideoPlayer(
  { courseId, video, unlocked, onTime, wide, onToggleWide },
  ref
) {
  const dispatch = useAppDispatch();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const saveTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const captionBlobRef = useRef(null);
  const toastTimer = useRef(null);
  const resumeTimer = useRef(null);

  // Furthest point the learner has legitimately reached. Seeking past this is
  // blocked; seeking back to anything at or before it (to re-watch) is allowed.
  const maxWatchedRef = useRef(0);

  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(video?.durationSeconds || 0);
  const [resumePrompt, setResumePrompt] = useState(null);
  const [rate, setRate] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [toast, setToast] = useState(null); // transient "−10s" / "Jumped to…" hint

  // Captions
  const [captionsSrc, setCaptionsSrc] = useState(null); // blob URL once loaded
  const [captionsOn, setCaptionsOn] = useState(false);


  const videoId = video?._id;
  const ready = video?.status === "ready";
  // captionsStatus may or may not be present on the course's video object; if
  // it's explicitly not ready we skip the fetch, otherwise we probe for a track.
  const captionsMaybe =
    !video?.captionsStatus || video.captionsStatus === "ready";

  // --- Establish stream session + attach HLS ---
  useEffect(() => {
    if (!unlocked || !ready || !videoId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Reset per-video UI state so nothing bleeds over from the previous video.
    setResumePrompt(null);
    setCurrent(0);
    setDuration(video?.durationSeconds || 0);
    setPlaying(false);
    maxWatchedRef.current = 0;

    (async () => {
      try {
        const res = await dispatch(
          startStreamSession({ courseId, videoId })
        ).unwrap();
        if (cancelled) return;
        setSession(res);
        // The resume point is already-watched content, so it becomes the
        // initial ceiling — the learner may seek back into it even if they
        // choose "Start over".
        if (res.resumeAtSeconds > 0) {
          maxWatchedRef.current = res.resumeAtSeconds;
        }
        if (res.resumeAtSeconds > 3) setResumePrompt(res.resumeAtSeconds);
        await attachSource(res.manifestUrl);
        // Captions ride the same signed cookie the session just set.
        loadCaptions(res.manifestUrl);
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not start playback");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, ready, videoId, courseId]);

  // --- Bookmarks + caption preference: load per video ---
  useEffect(() => {
    setBookmarks(loadBookmarks(videoId));
    setCaptionsOn(loadCaptionPref());
  }, [videoId]);

  // --- Fetch WebVTT captions through the signed stream cookie ---
  // We fetch (rather than pointing <track src> straight at the URL) so the
  // request is credentialed and same-origin, then hand the player a blob URL.
  // If there are no captions (404 / empty), the CC control simply won't appear.
  const loadCaptions = useCallback(
    async (manifestUrl) => {
      // Clear any previous track/blob first.
      if (captionBlobRef.current) {
        URL.revokeObjectURL(captionBlobRef.current);
        captionBlobRef.current = null;
      }
      setCaptionsSrc(null);

      if (!captionsMaybe) return;
      const vttUrl = captionsUrlFromManifest(manifestUrl);
      if (!vttUrl) return;

      try {
        const res = await fetch(vttUrl, { credentials: "include" });
        if (!res.ok) return; // no captions for this video
        const text = await res.text();
        if (!text || !/-->/.test(text)) return; // not a usable cue file
        const blob = new Blob([text], { type: "text/vtt" });
        const blobUrl = URL.createObjectURL(blob);
        captionBlobRef.current = blobUrl;
        setCaptionsSrc(blobUrl);
      } catch {
        /* captions are best-effort — ignore failures */
      }
    },
    [captionsMaybe]
  );

  // Keep the native text track's visibility in sync with the toggle.
  // Because the <track> is keyed by its blob URL (and the <video> by videoId),
  // there is only ever one live text track here — the current video's — so we
  // never accidentally re-show a previous video's cues.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !captionsSrc) return;
    const apply = () => {
      const tracks = el.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = captionsOn ? "showing" : "hidden";
      }
    };
    // textTracks may attach a tick after the <track> mounts.
    apply();
    const id = setTimeout(apply, 60);
    return () => clearTimeout(id);
  }, [captionsSrc, captionsOn]);

  const attachSource = useCallback(async (manifestPath) => {
    const el = videoRef.current;

    if (!el) {
      throw new Error("Video element is not ready.");
    }

    if (!manifestPath) {
      throw new Error("Video manifest URL is missing.");
    }

    /*
     * IMPORTANT
     *
     * Backend returns a browser-relative, same-origin URL:
     *
     *   /api/theProfessionalNetwork/lms/stream/<course>/<video>/index.m3u8
     *
     * The stream cookie is scoped to that path, so the manifest and every .ts
     * segment must be requested from the SAME origin. Do NOT prepend an
     * absolute API base here.
     */

    let url = manifestPath;

    if (!/^https?:\/\//i.test(url)) {
      if (!url.startsWith("/")) {
        url = `/${url}`;
      }
    }

    // ---------------------------------------------------------
    // Safari / browsers with native HLS support
    // ---------------------------------------------------------
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      // Same-origin credentialed media (cookie) — request with credentials.
      el.crossOrigin = "use-credentials";
      el.src = url;
      return;
    }

    // ---------------------------------------------------------
    // Chrome / Edge / Firefox -> hls.js
    // ---------------------------------------------------------
    const Hls = (await import("hls.js")).default;

    if (!Hls.isSupported()) {
      throw new Error("HLS playback is not supported in this browser.");
    }

    const hls = new Hls({
      enableWorker: true,

      /*
       * CRITICAL:
       * Stream authentication uses the HttpOnly cookie. There must NOT be a
       * Bearer Authorization header here — requests are credentialed instead.
       */
      xhrSetup: (xhr) => {
        xhr.withCredentials = true;
      },

      fetchSetup: (context, initParams) => {
        initParams.credentials = "include";
        return new Request(context.url, initParams);
      },
    });

    hlsRef.current = hls;

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      if (data.response?.code === 401) {
        setError("Your video session expired. Please reload the video.");
        return;
      }

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          setError("Unable to load the video stream.");
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          setError("The video could not be decoded.");
          break;
        default:
          setError("Video stream failed to load.");
      }
    });

    hls.attachMedia(el);
    hls.loadSource(url);
  }, []);

  const teardown = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (captionBlobRef.current) {
      URL.revokeObjectURL(captionBlobRef.current);
      captionBlobRef.current = null;
    }
    clearInterval(saveTimer.current);
    clearInterval(heartbeatTimer.current);
    clearTimeout(toastTimer.current);
    clearTimeout(resumeTimer.current);
  }, []);

  // --- Progress save (throttled) + heartbeat cadence ---
  useEffect(() => {
    if (!session || !videoId) return;
    saveTimer.current = setInterval(() => {
      const el = videoRef.current;
      if (el && !el.paused && el.currentTime > 0) {
        dispatch(
          saveProgress({
            courseId,
            videoId,
            positionSeconds: Math.floor(el.currentTime),
            durationSeconds: Math.floor(el.duration) || undefined,
          })
        );
      }
    }, 10000);

    const hb = (session.heartbeatSeconds || 300) * 1000;
    heartbeatTimer.current = setInterval(() => {
      dispatch(streamHeartbeat({ courseId, videoId }));
    }, hb);

    return () => {
      clearInterval(saveTimer.current);
      clearInterval(heartbeatTimer.current);
    };
  }, [session, videoId, courseId, dispatch]);

  // Resume / Start over.
  //
  // The original version set currentTime + play() synchronously. When the HLS
  // source hasn't reached metadata yet (readyState 0), the seek silently gets
  // dropped and play() can reject — which is why it looked like the buttons did
  // nothing. We now wait for metadata if needed, and swallow the play promise.
  const doResume = (fromZero) => {
    const el = videoRef.current;
    if (!el) return;

    const target = fromZero ? 0 : Math.max(0, resumePrompt || 0);
    setResumePrompt(null);

    const begin = () => {
      // The resume point is already-watched content, so this is a rewind into
      // the allowed range — never clamped.
      if (target > 0) el.currentTime = target;
      const p = el.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    if (el.readyState >= 1 /* HAVE_METADATA */) {
      begin();
    } else {
      el.addEventListener("loadedmetadata", begin, { once: true });
    }
  };

  // Auto-dismiss the resume prompt when the learner ignores it. The countdown
  // restarts from full on mouse-leave and is paused while hovering, so it won't
  // vanish just as they reach for a button.
  const startResumeTimeout = useCallback(() => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(
      () => setResumePrompt(null),
      RESUME_PROMPT_SECONDS * 1000
    );
  }, []);

  const clearResumeTimeout = useCallback(() => {
    clearTimeout(resumeTimer.current);
  }, []);

  // Start the countdown once the prompt is actually visible (i.e. not while the
  // player is still loading). Clears itself if the prompt goes away first.
  useEffect(() => {
    if (!resumePrompt || loading) return;
    startResumeTimeout();
    return () => clearTimeout(resumeTimer.current);
  }, [resumePrompt, loading, startResumeTimeout]);

  // --- Controls ---
  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    el.paused ? el.play()?.catch?.(() => {}) : el.pause();
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (el) {
      el.muted = !el.muted;
      setMuted(el.muted);
    }
  };

  const changeSpeed = (r) => {
    const el = videoRef.current;
    if (el) el.playbackRate = r;
    setRate(r);
    setSpeedOpen(false);
  };

  const toggleCaptions = () => {
    setCaptionsOn((v) => {
      const next = !v;
      persistCaptionPref(next);
      return next;
    });
  };

  const goFull = () => videoRef.current?.parentElement?.requestFullscreen?.();

  // Brief on-video hint ("−10s", "Jumped to 3:42").
  const flashToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1400);
  }, []);

  // Absolute seek that respects the no-skip-ahead ceiling. Rewinding into
  // already-watched content is always allowed; a jump PAST the furthest point
  // reached is clamped back to it. Shared by the buttons, progress bar,
  // bookmarks, discussion timestamps and the imperative seekTo handle.
  const seekToTime = useCallback((seconds) => {
    const el = videoRef.current;
    if (!el) return;
    const ceiling = maxWatchedRef.current + SEEK_TOLERANCE;
    const target = Math.min(Math.max(0, seconds), ceiling);
    el.currentTime = target;
    return target;
  }, []);

  // Rewind is unconditional; fast-forward is capped at the furthest point
  // already reached.
  const skip = useCallback(
    (delta) => {
      const el = videoRef.current;
      if (!el) return;
      const target =
        delta < 0
          ? Math.max(0, el.currentTime + delta) // rewind: never clamped
          : Math.min(el.currentTime + delta, maxWatchedRef.current + SEEK_TOLERANCE);
      el.currentTime = target;
      flashToast(`${delta > 0 ? "+" : "−"}${Math.abs(delta)}s`);
    },
    [flashToast]
  );

  // Allow seeking back into watched content, but silently clamp any attempt to
  // jump past the furthest point reached — from the bar, a bookmark, a
  // discussion timestamp, or keyboard shortcuts alike.
  const onSeeking = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.currentTime > maxWatchedRef.current + SEEK_TOLERANCE) {
      el.currentTime = maxWatchedRef.current;
    }
  };

  // Let the page drive the player (e.g. a discussion timestamp chip) without
  // reaching into the DOM.
  useImperativeHandle(ref, () => ({
    seekTo: (sec) => {
      const landed = seekToTime(sec);
      videoRef.current?.play?.()?.catch?.(() => {});
      if (landed != null) flashToast(`Jumped to ${clock(landed)}`);
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0,
  }));

  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.currentTime > maxWatchedRef.current) {
      maxWatchedRef.current = el.currentTime;
    }
    setCurrent(el.currentTime);
    onTime?.(Math.floor(el.currentTime));
  };

  // --- Keyboard shortcuts (scoped to the player container) ---
  const onKeyDown = (e) => {
    // Don't hijack typing in inputs.
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        goFull();
        break;
      case "c":
        if (captionsSrc) toggleCaptions();
        break;
      case "ArrowLeft":
        e.preventDefault();
        skip(-SEEK_STEP);
        break;
      case "ArrowRight":
        e.preventDefault();
        skip(SEEK_STEP);
        break;
      case "j":
      case "J":
        e.preventDefault();
        skip(-SKIP_STEP);
        break;
      case "l":
      case "L":
        e.preventDefault();
        skip(SKIP_STEP);
        break;
      case "t":
      case "T":
        e.preventDefault();
        onToggleWide?.();
        break;
      default:
        break;
    }
  };

  // --- Bookmarks ---
  const addBookmark = () => {
    const el = videoRef.current;
    if (!el) return;
    const time = Math.floor(el.currentTime || 0);
    setBookmarks((prev) => {
      if (prev.some((b) => Math.abs(b.time - time) <= 1)) return prev;
      const next = [
        ...prev,
        { id: `${Date.now()}-${time}`, time, createdAt: Date.now() },
      ].sort((a, b) => a.time - b.time);
      persistBookmarks(videoId, next);
      return next;
    });
  };

  const removeBookmark = (id) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      persistBookmarks(videoId, next);
      return next;
    });
  };

  const jumpToBookmark = (time) => {
    seekToTime(time);
    videoRef.current?.play?.()?.catch?.(() => {});
  };

  // --- Locked / not-ready states ---
  if (!unlocked) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-card bg-ink px-4 text-center text-cream-100">
        <Lock size={30} strokeWidth={1.5} className="mb-3 text-general-light" />
        <p className="font-serif text-lg sm:text-xl">This session is locked</p>
        <p className="mt-1 text-sm text-cream-300">
          Your access window is closed or you&apos;re not enrolled.
        </p>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-card bg-ink px-4 text-center text-cream-100">
        <Loader2 size={28} className="mb-3 animate-spin text-general-light" />
        <p className="font-serif text-base sm:text-lg">
          {video?.status === "failed" ? "This recording failed to process" : "Recording is still processing"}
        </p>
        <p className="mt-1 text-sm text-cream-300">
          {video?.status === "failed" ? "Contact the author." : "Check back shortly."}
        </p>
      </div>
    );
  }

  const pct = duration ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      className="overflow-hidden rounded-card bg-ink shadow-card outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="relative aspect-video bg-black">
        {/* key={videoId} gives every recording a fresh media element + text
            track, so nothing (captions, buffered range, currentTime) carries
            over from the previous video. */}
        <video
          key={videoId}
          ref={videoRef}
          className="h-full w-full"
          onPlay={() => {
            setPlaying(true);
            // Any playback makes the resume prompt moot — get it out of the way.
            setResumePrompt(null);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={onTimeUpdate}
          onSeeking={onSeeking}
          onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
          onClick={togglePlay}
          playsInline
          crossOrigin="use-credentials"
        >
          {captionsSrc && (
            // key={captionsSrc} forces the browser to re-parse the cue file
            // whenever the source changes — Chrome won't reload a <track> on a
            // bare src swap, which is what leaked the previous video's captions.
            <track
              key={captionsSrc}
              kind="subtitles"
              label="Captions"
              srcLang="en"
              src={captionsSrc}
              default={captionsOn}
            />
          )}
        </video>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 size={30} className="animate-spin text-white" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {resumePrompt && !loading && (
          <div
            onMouseEnter={clearResumeTimeout}
            onMouseLeave={startResumeTimeout}
            className="absolute bottom-16 left-3 right-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink/90 px-3 py-2.5 shadow-card backdrop-blur sm:bottom-20 sm:left-6 sm:right-auto sm:gap-3 sm:px-4 sm:py-3"
          >
            <span className="text-sm text-cream-100">
              Resume from {clock(resumePrompt)}?
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => doResume(false)}
                className="rounded-md bg-general px-3 py-1.5 text-sm font-medium text-white hover:bg-general-dark"
              >
                Resume
              </button>
              <button
                onClick={() => doResume(true)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-cream-100 hover:bg-white/20"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 px-4 py-2 font-mono text-sm text-white backdrop-blur">
            {toast}
          </div>
        )}
      </div>

      {/* Progress bar. Click or drag anywhere up to the furthest point you've
          reached to re-watch it; skipping *ahead* of that point stays disabled.
          Lighter fill = how far ahead a seek is allowed; ticks = bookmarks.
          py-2 gives a taller touch target without changing the visual height. */}
      <div
        className="group relative -my-2 w-full cursor-pointer py-2"
        role="slider"
        aria-label="Seek (within watched range)"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration) || 0}
        aria-valuenow={Math.floor(current) || 0}
        onPointerDown={(e) => {
          if (!duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const seekFromX = (clientX) => {
            const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
            seekToTime(ratio * duration);
          };
          seekFromX(e.clientX);
          const move = (ev) => seekFromX(ev.clientX);
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <div className="relative h-1.5 w-full bg-white/12">
          {duration > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-white/15"
              style={{ width: `${Math.min(100, (maxWatchedRef.current / duration) * 100)}%` }}
            />
          )}
          <div className="relative h-full bg-teal" style={{ width: `${pct}%` }} />
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
          {duration > 0 &&
            bookmarks.map((b) => (
              <span
                key={b.id}
                className="absolute top-1/2 h-2.5 w-[3px] -translate-y-1/2 rounded-sm bg-frontend-light"
                style={{ left: `${Math.min(100, (b.time / duration) * 100)}%` }}
              />
            ))}
        </div>
      </div>

      {/* Control bar — two clusters with justify-between so on wide screens they
          sit at the ends (as before), and on narrow screens the right cluster
          wraps to a second line instead of overflowing / getting clipped. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 bg-ink px-2.5 py-2.5 sm:gap-x-3 sm:px-4 sm:py-3">
        {/* Left cluster */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button onClick={togglePlay} className="text-cream-100 hover:text-white" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
          </button>
          <button onClick={toggleMute} className="text-cream-100 hover:text-white" aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Rewind 10s — the headline control: re-watch what you just heard. */}
          <button
            onClick={() => skip(-SKIP_STEP)}
            className="relative text-cream-100 hover:text-white"
            aria-label="Back 10 seconds"
            title="Back 10s (J or ←)"
          >
            <RotateCcw size={18} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold">
              10
            </span>
          </button>

          {/* Forward 10s — capped at the furthest point already watched. */}
          <button
            onClick={() => skip(SKIP_STEP)}
            className="relative text-cream-100 hover:text-white"
            aria-label="Forward 10 seconds"
            title="Forward 10s (L or →)"
          >
            <RotateCw size={18} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold">
              10
            </span>
          </button>

          <span className="whitespace-nowrap font-mono text-[11px] text-cream-300 sm:text-xs">
            {clock(current)} / {clock(duration)}
          </span>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Captions toggle — only shown when a caption track loaded */}
          {captionsSrc && (
            <button
              onClick={toggleCaptions}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors sm:px-2.5 ${
                captionsOn
                  ? "border-frontend-light bg-frontend/20 text-cream-100"
                  : "border-white/15 text-cream-100 hover:bg-white/10"
              }`}
              aria-label={captionsOn ? "Turn captions off" : "Turn captions on"}
              aria-pressed={captionsOn}
              title="Captions (c)"
            >
              {captionsOn ? <Captions size={15} /> : <CaptionsOff size={15} />} CC
            </button>
          )}

          {/* Bookmark current spot — label collapses to icon-only on mobile */}
          <button
            onClick={addBookmark}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-2 py-1 text-xs text-cream-100 transition-colors hover:bg-white/10 sm:px-2.5"
            aria-label="Bookmark this moment"
            title="Bookmark this moment"
          >
            <BookmarkPlus size={15} /> <span className="hidden sm:inline">Bookmark</span>
          </button>

          {/* Playback speed */}
          <div className="relative">
            <button
              onClick={() => setSpeedOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-2 py-1 text-xs text-cream-100 transition-colors hover:bg-white/10 sm:px-2.5"
              aria-label="Playback speed"
              title="Playback speed"
            >
              <Gauge size={15} /> {rate}×
            </button>
            {speedOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSpeedOpen(false)} />
                <div className="absolute bottom-full right-0 z-20 mb-2 w-24 overflow-hidden rounded-lg border border-white/10 bg-ink shadow-card">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/10 ${
                        s === rate ? "text-general-light" : "text-cream-100"
                      }`}
                    >
                      {s}×{s === 1 ? " (normal)" : ""}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Theater / full-width toggle — only matters on large screens, where
              the sidebar layout exists to break out of. On mobile/tablet the
              layout is already single-column, so hide it below lg. */}
          <button
            onClick={() => onToggleWide?.()}
            className={`hidden transition-colors lg:block ${
              wide ? "text-general-light hover:text-white" : "text-cream-100 hover:text-white"
            }`}
            aria-label={wide ? "Exit full width" : "Full width"}
            aria-pressed={!!wide}
            title="Full width (t)"
          >
            <RectangleHorizontal size={18} />
          </button>

          <button onClick={goFull} className="text-cream-100 hover:text-white" aria-label="Fullscreen">
            <Maximize size={18} />
          </button>
        </div>
      </div>

      {/* Saved bookmarks */}
      {bookmarks.length > 0 && (
        <div className="border-t border-white/8 bg-ink px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cream-300">
            <Bookmark size={12} /> Bookmarks
          </div>
          <div className="flex flex-wrap gap-2">
            {bookmarks.map((b) => (
              <span
                key={b.id}
                className="group flex items-center gap-1 rounded-full bg-white/8 py-1 pl-2.5 pr-1 text-xs text-cream-100"
              >
                <button
                  onClick={() => jumpToBookmark(b.time)}
                  className="font-mono hover:text-white"
                  title="Jump to bookmark"
                >
                  {clock(b.time)}
                </button>
                <button
                  onClick={() => removeBookmark(b.id)}
                  className="rounded-full p-0.5 text-cream-300 opacity-60 transition-opacity hover:text-white group-hover:opacity-100"
                  aria-label="Remove bookmark"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;