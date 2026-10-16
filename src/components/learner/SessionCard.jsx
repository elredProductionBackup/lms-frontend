"use client";

import Link from "next/link";
import { Lock, Play } from "lucide-react";
import { Badge, Dot, Avatar } from "@/components/ui/Primitives";
import { minutesLabel, plainText, formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/api";
import { PosterImage, STATIC_POSTER } from "@/components/learner/Poster";

// 
// thumbnailUrl can be an inline data:/blob: URI or an already-absolute URL —
// those must be used verbatim. Only real backend paths (e.g. "/media/…") get
// routed through mediaUrl(); passing a data URI through it would prepend a
// slash and break the image.
function resolveThumb(url) {
  if (!url) return null;
  if (/^(data:|blob:|https?:)/i.test(url)) return url;
  return mediaUrl(url);
}

export default function SessionCard({ course }) {
  const unlocked = !!course.unlocked;
  // Enrolled with the window closed: the video is locked but the course page
  // (comments, Q&A, notes) still works.
  const enrolled = typeof course.enrolled === "boolean" ? course.enrolled : unlocked;
  const accessEnded = enrolled && !unlocked;
  const durations = (course.videos || []).reduce(
    (sum, v) => sum + (v.durationSeconds || 0),
    0
  );
  const durLabel = minutesLabel(durations) || `${(course.videos || []).length || 0} clips`;
  // Course cover first, then the first module's thumbnail, then the TPN poster.
  const firstModuleThumb = (course.videos || []).find((v) => v.thumbnailUrl)?.thumbnailUrl;
  const sources = [
    ...new Set([resolveThumb(course.thumbnailUrl), resolveThumb(firstModuleThumb), STATIC_POSTER].filter(Boolean)),
  ];

  // Access window shown on the reference cards
  const until = course.accessEndAt || course.endAt || course.publishedAt;

  return (
    <Link
      href={`/courses/${course._id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-ink/8 bg-cream-50 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
    >
      {/* Header: real thumbnail when present, neutral block as fallback */}
      <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-ink to-ink-soft">
        <PosterImage
          sources={sources}
          alt={course.title || ""}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover ${
            unlocked ? "" : "grayscale-[0.4] brightness-75"
          }`}
        />
        {/* Scrim so the labels and play button stay readable over any image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25" />
        <span
          className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full ${
            unlocked ? "bg-white text-ink" : "bg-black/35 text-general-light"
          } shadow-lg transition-transform duration-200 group-hover:scale-105`}
        >
          {unlocked ? <Play size={22} fill="currentColor" /> : <Lock size={22} strokeWidth={1.75} />}
        </span>
        <span className="absolute bottom-4 right-4 z-10 rounded-md bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
          {durLabel}
        </span>
        {accessEnded && (
          <span className="absolute left-4 top-4 z-10 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            Video access ended
          </span>
        )}
        {!enrolled && (
          <span className="absolute left-4 top-4 z-10 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            Not enrolled
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        {/* <div className="mb-3">
          {unlocked ? (
            <Badge tone="available">
              <Dot tone="available" /> Available now
            </Badge>
          ) : (
            <Badge tone="closed">
              <Dot tone="closed" /> {course.status === "archived" ? "Archived" : "Closed"}
            </Badge>
          )}
        </div> */}

        <h3 className="font-serif text-xl leading-snug text-ink">{course.title}</h3>
        {course.detailsHtml && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">
            {plainText(course.detailsHtml, 150)}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-5">
          {/* <span className="flex items-center gap-2">
            <Avatar name={course.author?.name || "Instructor"} src={course.author?.avatarUrl} size={26} />
            <span className="text-sm text-ink-soft">{course.author?.name || "Instructor"}</span>
          </span> */}
          {/* {until && (
            <span className="text-xs text-ink-muted">
              until {formatDate(until, { month: "short", day: "numeric" })}
            </span>
          )} */}
        </div>
      </div>
    </Link>
  );
}