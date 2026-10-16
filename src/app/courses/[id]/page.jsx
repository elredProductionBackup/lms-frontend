"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlayCircle, CircleCheck, Lock, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchCourse, clearCurrentCourse } from "@/store/slices/coursesSlice";
import {
  clearDiscussions,
  setDiscussionVideo,
  fetchComments,
  fetchQuestions,
} from "@/store/slices/discussionsSlice";
import { clearNotes, setNotesVideo, fetchNotes } from "@/store/slices/notesSlice";
import {
  clearBookmarks,
  setBookmarksVideo,
  fetchBookmarks,
} from "@/store/slices/bookmarksSlice";
import RouteGuard from "@/components/auth/RouteGuard";
import TopNav from "@/components/learner/TopNav";
import VideoPlayer from "@/components/learner/VideoPlayer";
import { PosterImage, posterSources } from "@/components/learner/Poster";
import DiscussionPanel from "@/components/learner/DiscussionPanel";
import SiteFooter from "@/components/learner/SiteFooter";
import { Spinner } from "@/components/ui/Primitives";
import { clock } from "@/lib/format";
import { isSameUser } from "@/lib/identity";
import useCourseRealtime from "@/hooks/useCourseRealtime";

// 16:9 module thumbnail for the "In this session" list: the module's own
// thumbnail, else the course cover, else the TPN poster.
function ModuleThumb({ sources, children }) {
  return (
    <span className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink sm:w-28">
      <PosterImage
        sources={sources}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
        {children}
      </span>
    </span>
  );
}

// Moderation (pin / unpin / delete anyone's post) is allowed for an admin, or
// for the author of THIS course only. Any other author is just a viewer here,
// and the API answers their moderation calls with 403.
function canModerateCourse(course, role, user) {
  if (role === "admin") return true;
  if (role !== "author" || !course) return false;
  return isSameUser(user, course.authorId) || isSameUser(user, course.author);
}

function PlayerInner() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const { current, detailStatus } = useAppSelector((s) => s.courses);
  // Two flags from GET /courses/:id:
  //   unlocked - access window open, so the video plays
  //   enrolled - on the course and not removed, so comments, Q&A, notes,
  //              bookmarks and live updates work (even after the window ends)
  // Older responses without `enrolled` fall back to `unlocked`.
  const isEnrolled = (c) => (typeof c?.enrolled === "boolean" ? c.enrolled : Boolean(c?.unlocked));
  useCourseRealtime(id, Boolean(current?._id === id && isEnrolled(current)));
  const { role, user } = useAppSelector((s) => s.auth);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentTime, setCurrentTime] = useState(0);
  const [wide, setWide] = useState(false); // theater / full-width mode
  const playerRef = useRef(null);

  useEffect(() => {
    dispatch(fetchCourse(id));
    return () => {
      dispatch(clearCurrentCourse());
      dispatch(clearDiscussions());
      dispatch(clearNotes());
      dispatch(clearBookmarks());
    };
  }, [id, dispatch]);

  // Comments, questions, notes and bookmarks all belong to the recording in the
  // player, not the course. Whenever that recording changes, point every panel
  // at it (dropping the previous recording's data) and load all four lists in
  // parallel. Nothing carries over between recordings.
  //
  // The selected recording lives in the URL (?video=<videoId>) so a refresh,
  // a shared link or reopening the tab lands on the same recording. If the
  // param is missing or points at a recording that's no longer in the course,
  // fall back to the first one.
  const videoList = current?.videos || [];
  const requestedVideoId = searchParams.get("video");
  const selectedVideo =
    videoList.find((v) => v._id === requestedVideoId) || videoList[0] || null;
  const activeVideoId = selectedVideo?._id || null;

  // Write the selection into the URL. replace (not push) so Back still returns
  // to the sessions list instead of stepping through every recording clicked.
  const selectVideo = useCallback(
    (videoId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("video", videoId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Tidy a stale ?video= (e.g. the recording was deleted) to the one we fell
  // back to, so the URL always matches what's on screen.
  const courseLoaded = current?._id === id;
  useEffect(() => {
    if (!courseLoaded || !requestedVideoId || !activeVideoId) return;
    if (requestedVideoId !== activeVideoId) selectVideo(activeVideoId);
  }, [courseLoaded, requestedVideoId, activeVideoId, selectVideo]);
  const canLoadPanels = current?._id === id && isEnrolled(current);

  useEffect(() => {
    dispatch(setDiscussionVideo(activeVideoId));
    dispatch(setNotesVideo(activeVideoId));
    dispatch(setBookmarksVideo(activeVideoId));
    if (!activeVideoId || !canLoadPanels) return;
    const args = { courseId: id, videoId: activeVideoId };
    dispatch(fetchComments(args));
    dispatch(fetchQuestions(args));
    dispatch(fetchNotes(args));
    dispatch(fetchBookmarks(args));
  }, [id, activeVideoId, canLoadPanels, dispatch]);

  if (detailStatus === "loading" || !current) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  const videos = current.videos || [];
  const activeVideo = selectedVideo;
  const unlocked = !!current.unlocked;
  const enrolled = isEnrolled(current);
  const canModerate = canModerateCourse(current, role, user);

  // A seek requested from a discussion timestamp chip: hand it to the player,
  // which clamps it to already-watched content instead of poking the DOM.
  const requestSeek = (sec) => {
    if (sec == null) return;
    playerRef.current?.seekTo(sec);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      {/* Same max-width as TopNav (max-w-6xl) in BOTH modes so the content edges
          line up with the nav. "wide" doesn't grow the container — it only
          reflows the grid below (video full-width, comments beside the title). */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 sm:py-8">
        <Link
          href="/home"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline sm:mb-6"
        >
          <ArrowLeft size={16} /> Back to sessions
        </Link>

        {/*
         * One fixed DOM structure — three grid children (video / content /
         * comments). Only their grid placement changes between modes, so the
         * <VideoPlayer> is never remounted and playback keeps running when you
         * toggle theater mode.
         *
         * Mobile (< lg): single column, natural order -> video, title+desc+list,
         * then comments below.
         *
         * Normal (lg): [1fr 380px]
         *   video    -> col 1, row 1
         *   content  -> col 1, row 2
         *   comments -> col 2, rows 1-2 (tall sticky sidebar, as image 1)
         *
         * Theater (lg): [1fr 380px]
         *   video    -> cols 1-2, row 1 (full width)
         *   content  -> col 1, row 2
         *   comments -> col 2, row 2 (beside the title/description)
         */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Video */}
          <div
            className={`min-w-0 ${
              wide
                ? "lg:col-span-2 lg:row-start-1"
                : "lg:col-start-1 lg:row-start-1"
            }`}
          >
            <VideoPlayer
              ref={playerRef}
              courseId={id}
              video={activeVideo}
              unlocked={unlocked}
              enrolled={enrolled}
              onAccessLost={() => dispatch(fetchCourse(id))}
              onTime={setCurrentTime}
              posters={posterSources(activeVideo, current)}
              wide={wide}
              onToggleWide={() => setWide((v) => !v)}
            />
          </div>

          {/* Meta + video list */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <div>
              <h1 className="font-serif text-2xl leading-tight text-ink sm:text-3xl">
                {current.title}
              </h1>

              {current.detailsHtml && (
                <div
                  className="prose-lms mt-4 max-w-none text-[15px] text-ink-soft"
                  dangerouslySetInnerHTML={{ __html: current.detailsHtml }}
                />
              )}
            </div>

            {/* Module list (shown even for a single module, so its thumbnail
                is always visible alongside the player) */}
            {videos.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 font-serif text-lg text-ink">
                  In this session
                  <span className="ml-2 font-sans text-sm font-normal text-ink-muted">
                    {videos.length} {videos.length === 1 ? "module" : "modules"}
                  </span>
                </h2>
                <div className="space-y-2">
                  {videos.map((v, i) => {
                    const active = v._id === activeVideoId;
                    const ready = v.status === "ready";
                    return (
                      <button
                        key={v._id}
                        type="button"
                        onClick={() => ready && enrolled && !active && selectVideo(v._id)}
                        disabled={!ready || !enrolled}
                        aria-current={active ? "true" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors sm:gap-4 ${
                          active
                            ? "border-teal/60 bg-teal/[0.04]"
                            : "border-ink/8 bg-cream-50 hover:border-ink/15 hover:bg-cream-100"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <ModuleThumb sources={posterSources(v, current)}>
                          {!unlocked ? (
                            <Lock size={13} />
                          ) : active ? (
                            <PlayCircle size={15} />
                          ) : ready ? (
                            <CircleCheck size={13} />
                          ) : (
                            <Loader2 size={13} className="animate-spin" />
                          )}
                        </ModuleThumb>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {v.title || `Module ${i + 1}`}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            {active ? (
                              <span className="font-medium text-teal">Now playing</span>
                            ) : (
                              `Module ${i + 1}`
                            )}
                            {" · "}
                            {v.durationSeconds ? (
                              <span className="tabular-nums">{clock(v.durationSeconds)}</span>
                            ) : (
                              <span className="capitalize">{ready ? "Ready" : v.status}</span>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Discussion panel */}
          <aside
            className={`min-w-0 ${
              wide
                ? "lg:col-start-2 lg:row-start-2 lg:sticky lg:top-20"
                : "lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]"
            }`}
          >
            {enrolled ? (
              <DiscussionPanel
                courseId={id}
                videoId={activeVideo?._id}
                currentTime={currentTime}
                seekTo={requestSeek}
                canModerate={canModerate}
              />
            ) : (
              <div className="rounded-card border border-ink/8 bg-cream-50 p-6 text-center">
                <Lock size={22} strokeWidth={1.75} className="mx-auto mb-2 text-ink-muted" />
                <p className="font-serif text-lg text-ink">You&apos;re not enrolled</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Comments, Q&amp;A and notes open once your admin gives you a seat on this course.
                </p>
              </div>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function CoursePlayerPage() {
  return (
    <RouteGuard>
      {/* useSearchParams (the ?video= selection) needs a Suspense boundary. */}
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <Spinner size={28} />
          </div>
        }
      >
        <PlayerInner />
      </Suspense>
    </RouteGuard>
  );
}