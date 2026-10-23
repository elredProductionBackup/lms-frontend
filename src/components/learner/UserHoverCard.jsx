"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Briefcase, Building2, MapPin, ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/Primitives";

// Hover / focus / tap card with a person's public profile, used on avatars and
// names in the discussion panel.
//
// The card renders in a portal with fixed positioning because the comment
// lists scroll inside `overflow-hidden` containers, which would clip an
// absolutely positioned popover.

const OPEN_DELAY = 350; // ms before opening on hover, so passing over doesn't flash
const CLOSE_DELAY = 150; // ms grace to move the pointer from trigger onto the card
const GAP = 8; // px between trigger and card
const EDGE = 12; // px kept clear of the viewport edges
const CARD_WIDTH = 288;

// Falls back to a capitalized email handle when the user has no name.
export function displayName(u) {
  if (!u) return "";
  if (u.name?.trim()) return u.name.trim();
  if (u.email) {
    const handle = u.email.split("@")[0];
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  return "";
}

const ROLES = {
  admin: { label: "Admin", className: "bg-ink text-cream-50" },
  author: { label: "Author", className: "bg-teal/10 text-teal" },
  learner: { label: "Learner", className: "bg-ink/[0.06] text-ink-muted" },
};

const clean = (v) => (typeof v === "string" ? v.trim() : "");

// aboutHtml is user-written, so it's shown as plain text rather than injected
// as HTML. DOMParser doesn't run scripts, and textContent drops every tag.
function htmlToText(html) {
  const raw = clean(html);
  if (!raw) return "";
  if (typeof window === "undefined") return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const doc = new DOMParser().parseFromString(raw, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function formatLocation(loc) {
  if (!loc) return "";
  return [loc.city, loc.state, loc.country].map(clean).filter(Boolean).join(", ");
}

// Accepts "linkedin.com/in/x" or a full URL; only http(s) links are kept so a
// stored "javascript:..." value can never become a clickable link.
function safeUrl(raw) {
  const v = clean(raw);
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const linkLabel = (url) => `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;

function DetailRow({ icon: Icon, value, emptyText, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} strokeWidth={1.75} className="mt-[3px] shrink-0 text-ink-muted" aria-hidden="true" />
      {value ? (
        <span className="min-w-0 flex-1 break-words text-[13px] leading-5 text-ink">{children ?? value}</span>
      ) : (
        <span className="min-w-0 flex-1 text-[13px] leading-5 text-ink-muted">{emptyText}</span>
      )}
    </div>
  );
}

function ProfileCard({ user, showEmail }) {
  const name = displayName(user) || "Unknown user";
  const firstName = name.split(/\s+/)[0];
  const role = ROLES[user.role];
  const about = htmlToText(user.aboutHtml);
  const profession = clean(user.profession);
  const company = clean(user.companyDisplayName);
  const location = formatLocation(user.location);
  const linkedIn = safeUrl(user.linkedInUrl);
  const email = clean(user.email);
  const hasDetails = Boolean(about || profession || company || location || linkedIn);

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={name} src={user.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-sm font-semibold text-ink">{name}</p>
            {role && (
              <span className={`rounded-full px-2 py-px text-[11px] font-medium leading-4 ${role.className}`}>
                {role.label}
              </span>
            )}
          </div>
          {showEmail && email && (
            <a
              href={`mailto:${email}`}
              className="mt-0.5 block truncate text-xs text-ink-muted hover:text-teal hover:underline"
            >
              {email}
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-ink/8 pt-3">
        {hasDetails ? (
          <>
            {about ? (
              <p className="line-clamp-4 break-words text-[13px] leading-relaxed text-ink-soft">{about}</p>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-muted">{`${firstName} hasn't added a bio yet.`}</p>
            )}
            <div className="mt-3 space-y-1.5">
              <DetailRow icon={Briefcase} value={profession} emptyText="Profession not added" />
              <DetailRow icon={Building2} value={company} emptyText="Company not added" />
              <DetailRow icon={MapPin} value={location} emptyText="Location not added" />
              <DetailRow icon={ExternalLink} value={linkedIn} emptyText="LinkedIn profile not added">
                {linkedIn && (
                  <a
                    href={linkedIn.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-teal hover:underline"
                  >
                    {linkLabel(linkedIn)}
                  </a>
                )}
              </DetailRow>
            </div>
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {`${firstName} hasn't added any profile details yet.`}
          </p>
        )}
      </div>
    </>
  );
}

// Wrap an avatar or a name with this. Opens on mouse hover (after a short
// delay), on keyboard focus, and on tap for touch screens. Closes on leave,
// blur, Escape, outside click, or when the trigger scrolls out of view.
//
// showEmail: pass true only for moderators; learners don't see emails.
export default function UserHoverCard({ user, showEmail = false, className = "", children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const timer = useRef(null);
  const pointerType = useRef("mouse");
  const cardId = useId();

  const schedule = useCallback((next, delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  }, []);
  const cancel = useCallback(() => clearTimeout(timer.current), []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Below the trigger by default; above it when there's no room below.
  // Horizontally clamped so the card never runs off screen on mobile.
  const place = useCallback(() => {
    const t = triggerRef.current;
    const c = cardRef.current;
    if (!t || !c) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) {
      setOpen(false); // trigger scrolled away
      return;
    }
    const width = Math.min(CARD_WIDTH, vw - EDGE * 2);
    const h = c.offsetHeight;
    const left = Math.max(EDGE, Math.min(r.left, vw - width - EDGE));
    const below = r.bottom + GAP;
    const above = r.top - GAP - h;
    let top = below;
    if (below + h > vh - EDGE) top = above >= EDGE ? above : Math.max(EDGE, vh - h - EDGE);
    setPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    place();
    window.addEventListener("scroll", place, true); // capture: catches the inner list scrolling too
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target) || cardRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Not a populated user object (e.g. a bare id): render the children as-is.
  if (!user || typeof user !== "object") return children;

  const name = displayName(user) || "this user";

  const toggleFromTap = () => {
    cancel();
    if (pointerType.current === "mouse") setOpen(true);
    else setOpen((v) => !v);
  };

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType;
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && schedule(true, OPEN_DELAY)}
        onPointerLeave={(e) => e.pointerType === "mouse" && schedule(false, CLOSE_DELAY)}
        onFocus={() => schedule(true, OPEN_DELAY)}
        onBlur={(e) => {
          if (cardRef.current?.contains(e.relatedTarget)) return;
          schedule(false, CLOSE_DELAY);
        }}
        onClick={toggleFromTap}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            cancel();
            setOpen((v) => !v);
          }
        }}
        aria-label={`View ${name}'s profile`}
        className={`inline-flex min-w-0 cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${className}`}
      >
        {children}
      </span>

      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="dialog"
            aria-label={`${name}'s profile`}
            onPointerEnter={(e) => e.pointerType === "mouse" && cancel()}
            onPointerLeave={(e) => e.pointerType === "mouse" && schedule(false, CLOSE_DELAY)}
            onBlur={(e) => {
              if (triggerRef.current?.contains(e.relatedTarget) || cardRef.current?.contains(e.relatedTarget)) return;
              schedule(false, CLOSE_DELAY);
            }}
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: pos?.width ?? CARD_WIDTH,
              opacity: pos ? 1 : 0, // hidden for the one frame before it's measured
            }}
            className="z-[60] rounded-xl border border-ink/10 bg-cream-50 p-4 text-left shadow-lg shadow-ink/10 transition-opacity duration-150 motion-reduce:transition-none"
          >
            <ProfileCard user={user} showEmail={showEmail} />
          </div>,
          document.body
        )}
    </>
  );
}