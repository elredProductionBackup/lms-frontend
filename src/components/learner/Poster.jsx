"use client";

import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/api";

// Default poster when neither the module nor the course has a usable image.
export const STATIC_POSTER = "/video-poster.svg?v=2";

// Images to try for a module, best first: the module's own thumbnail, then the
// course cover, then the static TPN poster. If one fails to load (missing,
// expired link, blocked), the next one is used.
export function posterSources(video, course) {
  const list = [];
  if (video?.thumbnailUrl) list.push(mediaUrl(video.thumbnailUrl));
  if (course?.thumbnailUrl) list.push(mediaUrl(course.thumbnailUrl));
  list.push(STATIC_POSTER);
  return [...new Set(list.filter(Boolean))];
}

// A plain <img> that walks the fallback list on error. Deliberately NOT the
// <video poster> attribute: the player sets crossOrigin="use-credentials" for
// the stream cookie, and Chrome applies that to the poster request too, so a
// thumbnail on S3/CDN without CORS headers silently fails and the player shows
// black. A separate <img> has no such restriction.
export function PosterImage({ sources, alt = "", className = "", ...props }) {
  const key = sources.join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [key]);

  const src = sources[Math.min(index, sources.length - 1)];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setIndex((i) => (i < sources.length - 1 ? i + 1 : i))}
      className={className}
      {...props}
    />
  );
}
