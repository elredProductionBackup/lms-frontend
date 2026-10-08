"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import { initialsOf } from "@/lib/format";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  disabled,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = {
    sm: "px-3.5 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };
  const variants = {
    primary: "bg-ink text-cream-50 hover:bg-ink-soft",
    teal: "bg-teal text-white hover:bg-teal-dark",
    outline: "border border-ink/20 text-ink hover:bg-ink/5 bg-transparent",
    ghost: "text-ink-soft hover:bg-ink/5",
    danger: "border border-red-300 text-red-700 hover:bg-red-50 bg-transparent",
    subtle: "bg-cream-200 text-ink hover:bg-cream-300",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "default", className = "" }) {
  const tones = {
    default: "bg-cream-200 text-ink-soft",
    available: "bg-available/12 text-available",
    closed: "bg-ink/8 text-closed",
    draft: "bg-general/15 text-general-dark",
    published: "bg-available/12 text-available",
    archived: "bg-ink/10 text-ink-muted",
    admin: "bg-backend/12 text-backend",
    author: "bg-frontend/12 text-frontend",
    learner: "bg-general/15 text-general-dark",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${tones[tone] || tones.default} ${className}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "available" }) {
  const c = { available: "bg-available", closed: "bg-closed", live: "bg-available" };
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${c[tone] || c.available} ${tone === "live" ? "animate-pulse-dot" : ""}`}
    />
  );
}

export function Spinner({ size = 20, className = "" }) {
  return <Loader2 size={size} className={`animate-spin text-ink-muted ${className}`} />;
}

export function Avatar({ name, src, size = 36, className = "" }) {
  const url = src ? mediaUrl(src) : null;
  // Track whether the image failed to load so we can fall back to initials.
  // Reset the error whenever the source changes (e.g. after an avatar upload)
  // so a fresh URL is always re-attempted instead of staying broken.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);

  const initials = (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-teal text-white font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initialsOf(name)}
    </span>
  );

  if (!url || failed) return initials;

  return (
    <img
      src={url}
      alt={name || "avatar"}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
