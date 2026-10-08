// Small presentation helpers shared across the app.

export function formatDate(iso, opts) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(
    "en-US",
    opts || { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  );
}

export function formatDay(iso) {
  return formatDate(iso, { month: "short", day: "numeric", year: "numeric" });
}

export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function minutesLabel(seconds) {
  if (!seconds) return null;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

// The reference UI assigns each course to a colored track. We derive a stable
// pseudo-category from the course id so cards look like the mockups even though
// the backend has no "category" field.
const TRACKS = ["frontend", "general", "backend"];
export function trackFor(course) {
  const explicit = (course?.track || course?.category || "").toLowerCase();
  if (TRACKS.includes(explicit)) return explicit;
  const id = String(course?._id || "");
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return TRACKS[sum % TRACKS.length];
}

export const TRACK_META = {
  frontend: { label: "Frontend", grad: "from-frontend-dark to-frontend-light", text: "text-frontend" },
  general: { label: "General", grad: "from-general-dark to-general-light", text: "text-general" },
  backend: { label: "Backend", grad: "from-backend-dark to-backend-light", text: "text-backend" },
};

export function initialsOf(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Strip HTML for card previews.
export function plainText(html, max = 160) {
  if (!html) return "";
  const text = String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}
