"use client";

import { useAppSelector } from "@/hooks/redux";
import { mediaUrl } from "@/lib/api";
import { SITE } from "@/lib/site";

// TPN logo + an "LMS" capsule. Used in the top nav, admin sidebar, login and
// footer so the lockup is the same everywhere.
//   tone="light" -> on light surfaces   tone="dark" -> on dark surfaces
const SIZES = {
  sm: { logo: "h-7", pill: "ml-2 px-2 py-0.5 text-[10px]" },
  md: { logo: "h-8", pill: "ml-2.5 px-2.5 py-0.5 text-[11px]" },
  lg: { logo: "h-12", pill: "ml-3 px-3 py-1 text-xs" },
};

export default function BrandMark({ tone = "light", size = "md", className = "" }) {
  const settings = useAppSelector((s) => s.settings);
  const s = SIZES[size] || SIZES.md;
  const dark = tone === "dark";

  const src = dark
    ? "/tpn-white.svg"
    : settings?.logoUrl
      ? mediaUrl(settings.logoUrl)
      : "/tpn.svg";

  return (
    <span className={`inline-flex items-center ${className}`}>
      <img src={src} alt={settings?.name || SITE.name} className={`${s.logo} w-auto shrink-0`} />
      <span
        className={`inline-flex shrink-0 items-center rounded-full border font-semibold uppercase leading-none tracking-[0.08em] ${s.pill} ${
          dark ? "border-white/25 bg-white/10 text-white" : "border-teal/25 bg-teal/[0.06] text-teal"
        }`}
      >
        {SITE.product}
      </span>
    </span>
  );
}