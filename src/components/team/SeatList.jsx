"use client";

import { ArrowLeftRight, UserMinus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Shell";
import { Avatar, Badge, Button } from "@/components/ui/Primitives";

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// One line under the name saying where this person is.
function seatMeta(seat) {
  const p = seat.progress;
  if (seat.status === "joined") {
    if (p && p.totalModules > 0 && p.modulesDone >= p.totalModules) return `Finished all ${p.totalModules} modules`;
    if (p && (p.modulesDone > 0 || p.lastWatchedAt)) {
      const when = p.lastWatchedAt ? `, last watched ${timeAgo(p.lastWatchedAt)}` : "";
      return `${p.modulesDone} of ${p.totalModules} modules done${when}`;
    }
    return seat.lastLoginAt ? `Signed in ${timeAgo(seat.lastLoginAt)}, hasn't started yet` : "Hasn't started yet";
  }
  if (seat.inviteSentAt) return `Invite sent ${timeAgo(seat.inviteSentAt)}, hasn't signed in yet`;
  return `Added ${timeAgo(seat.assignedAt)}, hasn't signed in yet`;
}

function SeatRow({ seat, busy, readOnly, onReplace, onRemove }) {
  const joined = seat.status === "joined";
  const name = seat.name?.trim();
  const p = seat.progress;
  const pct = joined && p ? Math.max(0, Math.min(100, Math.round(p.percent ?? 0))) : 0;
  const showBar = joined && p && (p.modulesDone > 0 || p.lastWatchedAt);
  const label = name || seat.email;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={label} src={seat.avatarUrl || null} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{label}</p>
            {seat.isOwner && <Badge tone="admin">You</Badge>}
            <Badge tone={joined ? "available" : "draft"}>{joined ? "Joined" : "Invited"}</Badge>
          </div>
          {name && <p className="truncate text-xs text-ink-muted">{seat.email}</p>}
          <p className="mt-0.5 text-xs text-ink-muted">{seatMeta(seat)}</p>
          {p?.lastVideoTitle && joined && (
            <p className="mt-0.5 truncate text-xs text-ink-muted">Last watched: {p.lastVideoTitle}</p>
          )}
          {showBar && (
            <div className="mt-2 h-1 w-full max-w-[14rem] overflow-hidden rounded-full bg-cream-200" aria-hidden>
              <div className="h-full rounded-full bg-available" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>

      {!seat.isOwner && !readOnly && (
        <div className="flex shrink-0 items-center gap-1 pl-[50px] sm:pl-0">
          <Button size="sm" variant="ghost" onClick={() => onReplace(seat)} disabled={busy}>
            <ArrowLeftRight size={14} /> Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(seat)}
            disabled={busy}
            className="hover:!bg-red-50 hover:text-red-700"
            aria-label={`Remove ${label}`}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
            Remove
          </Button>
        </div>
      )}
    </li>
  );
}

function OpenRow({ index }) {
  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-dashed border-ink/20 text-xs text-ink-muted">
        {index + 1}
      </span>
      <p className="text-sm text-ink-muted">Open seat</p>
    </li>
  );
}

export default function SeatList({ plan, busyEmail, readOnly, refreshing, onReplace, onRemove }) {
  const seats = plan.seats || [];
  const used = plan.seatsUsed ?? seats.length;
  const openCount = Math.max(0, plan.seatLimit - seats.length);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink/8 px-5 py-4">
        <h2 className="font-serif text-lg text-ink">Seats</h2>
        <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
          {refreshing && <Loader2 size={14} className="animate-spin" aria-label="Updating" />}
          {used} of {plan.seatLimit} in use
        </p>
      </div>
      <ul className="divide-y divide-ink/8">
        {seats.map((seat) => (
          <SeatRow
            key={seat.email}
            seat={seat}
            busy={busyEmail === seat.email}
            readOnly={readOnly}
            onReplace={onReplace}
            onRemove={onRemove}
          />
        ))}
        {Array.from({ length: openCount }, (_, i) => (
          <OpenRow key={`open-${i}`} index={seats.length + i} />
        ))}
      </ul>
    </Card>
  );
}
