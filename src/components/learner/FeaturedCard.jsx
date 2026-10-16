"use client";

import Link from "next/link";
import { Play, ArrowRight } from "lucide-react";
import { plainText } from "@/lib/format";

// Same background as the login page's brand hero panel:
// deep charcoal lit by a crimson glow in the bottom-right.
const HERO_GRADIENT =
  "radial-gradient(120% 120% at 88% 92%, rgba(153,18,27,0.40) 0%, rgba(0,0,0,0) 55%), linear-gradient(150deg, #1c1215 0%, #141317 55%, #0d0d10 100%)";

// Subtle dot texture, also from the login hero.
const DOT_TEXTURE =
  "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)";

export default function FeaturedCard({ course }) {
  if (!course) return null;

  return (
    <Link
      href={`/courses/${course._id}`}
      style={{ background: HERO_GRADIENT }}
      className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-card p-6 transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:min-h-[280px] sm:p-10"
    >
      {/* Dot texture for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: DOT_TEXTURE,
          backgroundSize: "22px 22px",
          opacity: 0.6,
        }}
      />

      {/* sm:pr-36 keeps the copy clear of the big play button on the right */}
      <div className="relative z-10 min-w-0 max-w-2xl sm:pr-36 lg:pr-0">
        <h2 className="line-clamp-3 break-words font-serif text-2xl leading-tight text-white sm:mt-6 sm:text-4xl">
          {course.title}
        </h2>
        <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/70 sm:mt-4 sm:line-clamp-none sm:text-[15px]">
          {plainText(course.detailsHtml, 200)}
        </p>
      </div>

      <span className="relative z-10 mt-6 inline-flex items-center gap-3 text-sm font-semibold text-white sm:mt-8 sm:gap-2">
        {/* Small play button on mobile, sits beside the call to action */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm sm:hidden">
          <Play size={16} fill="currentColor" />
        </span>
        {course.resume ? "Resume watching" : "Start watching"}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </span>

      {/* Large play button on tablet and up */}
      <span className="absolute right-8 top-1/2 z-10 hidden h-24 w-24 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform duration-200 group-hover:scale-105 sm:flex">
        <Play size={32} fill="currentColor" />
      </span>
    </Link>
  );
}