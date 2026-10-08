// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { Play, ArrowRight } from "lucide-react";
// import { Dot } from "@/components/ui/Primitives";
// import { plainText, trackFor, TRACK_META } from "@/lib/format";
// import { mediaUrl } from "@/lib/api";

// export default function FeaturedCard({ course }) {
//   const [thumbFailed, setThumbFailed] = useState(false);
//   if (!course) return null;
//   const meta = TRACK_META[trackFor(course)];
//   const thumb = course.thumbnailUrl ? mediaUrl(course.thumbnailUrl) : null;
//   const showThumb = thumb && !thumbFailed;

//   return (
//     <Link
//       href={`/courses/${course._id}`}
//       className={`group relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-card bg-gradient-to-br ${meta.grad} p-8 sm:p-10`}
//     >
//       {/* Thumbnail background (falls back to the track gradient) */}
//       {showThumb && (
//         <>
//           <img
//             src={thumb}
//             alt={course.title || ""}
//             onError={() => setThumbFailed(true)}
//             className="absolute inset-0 h-full w-full object-cover"
//           />
//           {/* Scrim: darker on the left where the copy sits, so text stays readable */}
//           <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
//         </>
//       )}

//       <div className="relative z-10 max-w-2xl">
//         {/* <span className="inline-flex items-center gap-2 rounded-full bg-cream-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-available">
//           <Dot tone="available" /> Available now
//         </span> */}
//         <h2 className="mt-6 font-serif text-3xl leading-tight text-white sm:text-4xl">
//           {course.title}
//         </h2>
//         <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85">
//           {plainText(course.detailsHtml, 200)}
//         </p>
//       </div>

//       <span className="relative z-10 mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white">
//         {course.resume ? "Resume watching" : "Start watching"}
//         <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
//       </span>

//       <span className="absolute right-8 top-1/2 z-10 hidden h-24 w-24 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/25 text-white backdrop-blur-sm transition-transform duration-200 group-hover:scale-105 sm:flex">
//         <Play size={32} fill="currentColor" />
//       </span>
//     </Link>
//   );
// }

"use client";

import Link from "next/link";
import { Play, ArrowRight } from "lucide-react";
import { plainText, trackFor } from "@/lib/format";

// Track palettes pulled straight from the theme (tailwind.config.js):
// [dark, base, light]. Building the gradient inline (rather than via Tailwind
// gradient classes) guarantees it renders and lets each card vary on-theme.
const PALETTES = {
  frontend: ["#99121B", "#C01823", "#DB4A53"], // brand crimson
  general: ["#48494C", "#6B6C6F", "#9A9B9E"], // brand gray
  backend: ["#1E1F21", "#2E2F31", "#54565A"], // charcoal
};

// Stable hash so a given course always gets the same look (no flicker / no
// hydration mismatch), while different courses get different angles + stops.
function hashId(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export default function FeaturedCard({ course }) {
  if (!course) return null;

  const track = trackFor(course);
  const [dark, base, light] = PALETTES[track] || PALETTES.general;
  const h = hashId(course._id || course.title || "");
  const angle = 105 + (h % 55); // 105°–159°: keeps the dark end near the copy
  const mid = 42 + (h % 26); // 42%–67%: shifts where the mid tone lands

  const gradient = `linear-gradient(${angle}deg, ${dark} 0%, ${base} ${mid}%, ${light} 100%)`;

  return (
    <Link
      href={`/courses/${course._id}`}
      style={{ backgroundImage: gradient }}
      className="group relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-card p-8 sm:p-10"
    >
      {/* Soft highlight in the top-right for a bit of depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(120% 80% at 85% 0%, rgba(255,255,255,0.18), transparent 60%)",
        }}
      />
      {/* Legibility scrim on the left where the text sits */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 to-transparent" />

      <div className="relative z-10 max-w-2xl">
        <h2 className="mt-6 font-serif text-3xl leading-tight text-white sm:text-4xl">
          {course.title}
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85">
          {plainText(course.detailsHtml, 200)}
        </p>
      </div>

      <span className="relative z-10 mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white">
        {course.resume ? "Resume watching" : "Start watching"}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </span>

      <span className="absolute right-8 top-1/2 z-10 hidden h-24 w-24 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm transition-transform duration-200 group-hover:scale-105 sm:flex">
        <Play size={32} fill="currentColor" />
      </span>
    </Link>
  );
}