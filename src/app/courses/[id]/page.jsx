"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlayCircle, CircleCheck, Lock } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchCourse, clearCurrentCourse } from "@/store/slices/coursesSlice";
import { clearDiscussions } from "@/store/slices/discussionsSlice";
import { clearNotes } from "@/store/slices/notesSlice";
import RouteGuard from "@/components/auth/RouteGuard";
import TopNav from "@/components/learner/TopNav";
import VideoPlayer from "@/components/learner/VideoPlayer";
import DiscussionPanel from "@/components/learner/DiscussionPanel";
import { Spinner, Badge, Dot, Avatar } from "@/components/ui/Primitives";
import { clock } from "@/lib/format";

function PlayerInner() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const { current, detailStatus } = useAppSelector((s) => s.courses);
  const [activeIdx, setActiveIdx] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [wide, setWide] = useState(false); // theater / full-width mode
  const playerRef = useRef(null);

  useEffect(() => {
    dispatch(fetchCourse(id));
    return () => {
      dispatch(clearCurrentCourse());
      dispatch(clearDiscussions());
      dispatch(clearNotes());
    };
  }, [id, dispatch]);

  if (detailStatus === "loading" || !current) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  const videos = current.videos || [];
  const activeVideo = videos[activeIdx] || videos[0];
  const unlocked = !!current.unlocked;

  // A seek requested from a discussion timestamp chip: hand it to the player,
  // which clamps it to already-watched content instead of poking the DOM.
  const requestSeek = (sec) => {
    if (sec == null) return;
    playerRef.current?.seekTo(sec);
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      {/* Same max-width as TopNav (max-w-6xl) in BOTH modes so the content edges
          line up with the nav. "wide" doesn't grow the container — it only
          reflows the grid below (video full-width, comments beside the title). */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
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
              onTime={setCurrentTime}
              wide={wide}
              onToggleWide={() => setWide((v) => !v)}
            />
          </div>

          {/* Meta + video list */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <div>
              {/* <div className="mb-2 flex items-center gap-3">
                {unlocked ? (
                  <Badge tone="available">
                    <Dot tone="available" /> Available now
                  </Badge>
                ) : (
                  <Badge tone="closed">
                    <Dot tone="closed" /> Locked
                  </Badge>
                )}
              </div> */}
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

            {/* Video list */}
            {videos.length > 1 && (
              <div className="mt-8">
                <h2 className="mb-3 font-serif text-lg text-ink">
                  In this session · {videos.length} recordings
                </h2>
                <div className="space-y-2">
                  {videos.map((v, i) => {
                    const active = i === activeIdx;
                    const ready = v.status === "ready";
                    return (
                      <button
                        key={v._id}
                        onClick={() => ready && unlocked && setActiveIdx(i)}
                        disabled={!ready || !unlocked}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors sm:px-4 ${
                          active
                            ? "border-teal bg-teal/6"
                            : "border-ink/8 bg-cream-50 hover:bg-cream-100"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {!unlocked ? (
                          <Lock size={18} className="shrink-0 text-ink-muted" />
                        ) : active ? (
                          <PlayCircle size={18} className="shrink-0 text-teal" />
                        ) : ready ? (
                          <CircleCheck size={18} className="shrink-0 text-ink-muted" />
                        ) : (
                          <Spinner size={16} />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {v.title || `Recording ${i + 1}`}
                        </span>
                        {v.durationSeconds ? (
                          <span className="shrink-0 font-mono text-xs text-ink-muted">
                            {clock(v.durationSeconds)}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs capitalize text-ink-muted">{v.status}</span>
                        )}
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
            <DiscussionPanel courseId={id} currentTime={currentTime} seekTo={requestSeek} />
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function CoursePlayerPage() {
  return (
    <RouteGuard>
      <PlayerInner />
    </RouteGuard>
  );
}