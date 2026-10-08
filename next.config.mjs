// The browser talks to this app's OWN origin at /api/theProfessionalNetwork/lms/*
// and Next.js proxies that to the real backend below. This is what makes video
// playback work: the stream-session endpoint sets an HttpOnly cookie, and the
// HLS manifest/segment requests are authenticated by that cookie — which the
// browser only sends if those requests are same-origin with the one that set it.
// Pointing the browser straight at the backend would set the cookie on a
// different host and playback would 401. So everything goes through this proxy.
//
// Set the backend URL once (any of these names works):
//   NEXT_PUBLIC_API_BASE_URL  (recommended)  API_ORIGIN  NEXT_PUBLIC_API_URL
// e.g. https://pretest.elred.io/api/theProfessionalNetwork/lms
function normalizeOrigin(value, fallback) {
  const raw = (value || "").trim().replace(/\/+$/, "");

  if (!raw) {
    return fallback;
  }

  return /^https?:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
}

const API_ORIGIN = normalizeOrigin(
  process.env.API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL,
  "https://pretest.elred.io/api/theProfessionalNetwork/lms"
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.devtunnels.ms" },
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },

  async rewrites() {
    return [
      {
        // Same-origin path the browser calls -> real backend.
        source: "/api/theProfessionalNetwork/lms/:path*",
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;