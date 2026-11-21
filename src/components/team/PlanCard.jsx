"use client";

import { useState } from "react";
import { CalendarDays, Infinity as InfinityIcon } from "lucide-react";
import { formatDay, initialsOf } from "@/lib/format";
import { mediaUrl } from "@/lib/api";

// Same charcoal-and-crimson surface as FeaturedCard and the login hero.
const HERO_GRADIENT =
  "radial-gradient(120% 120% at 88% 92%, rgba(153,18,27,0.40) 0%, rgba(0,0,0,0) 55%), linear-gradient(150deg, #1c1215 0%, #141317 55%, #0d0d10 100%)";
const DOT_TEXTURE = "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)";

function daysLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

// One circle per seat: joined, invited, or open.
function Slot({ seat, index }) {
  if (!seat) {
    return (
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-white/30 text-sm text-white/45 sm:h-14 sm:w-14"
        title={`Seat ${index + 1}: open`}
      >
        {index + 1}
      </span>
    );
  }
  const joined = seat.status === "joined";
  const who = seat.isOwner ? "you" : seat.name || seat.email;
  return (
    <span
      className={`relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold sm:h-14 sm:w-14 sm:text-base ${
        joined ? "bg-white text-ink" : "border border-dashed border-white/60 bg-white/10 text-white"
      }`}
      title={`Seat ${index + 1}: ${who} (${joined ? "joined" : "invited"})`}
    >
      {initialsOf(seat.name || seat.email.split("@")[0])}
      {seat.isOwner && (
        <span className="absolute -bottom-1 rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-white">
          You
        </span>
      )}
    </span>
  );
}

export default function PlanCard({ plan }) {
  const seats = plan.seats || [];
  const limit = plan.seatLimit;
  const used = plan.seatsUsed ?? seats.length;
  const open = plan.seatsAvailable ?? Math.max(0, limit - used);
  const left = daysLeft(plan.accessEndAt);
  const thumb = plan.course?.thumbnailUrl ? mediaUrl(plan.course.thumbnailUrl) : null;
  const [thumbOk, setThumbOk] = useState(true);

  return (
    <section
      style={{ background: HERO_GRADIENT }}
      className="relative overflow-hidden rounded-card p-6 text-white sm:p-8"
      aria-label="Your enterprise plan"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: DOT_TEXTURE, backgroundSize: "22px 22px", opacity: 0.6 }}
      />

      <div className="relative z-10 flex gap-6">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85">
            Enterprise plan
          </span>
          <h2 className="mt-4 break-words font-serif text-2xl leading-tight sm:text-3xl">
            {plan.course?.title}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/65">
            {plan.companyName && (
              <>
                <span>{plan.companyName}</span>
                <span aria-hidden>·</span>
              </>
            )}
            {plan.isLifetime ? (
              <span className="inline-flex items-center gap-1.5">
                <InfinityIcon size={15} className="text-white/45" /> Lifetime access
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-white/45" />
                  {formatDay(plan.accessStartAt)} to {formatDay(plan.accessEndAt)}
                </span>
                <span aria-hidden>·</span>
                <span>{left === 0 ? "Ends today" : `${left} days left`}</span>
              </>
            )}
          </p>
        </div>

        {thumb && thumbOk && (
          <img
            src={thumb}
            alt=""
            onError={() => setThumbOk(false)}
            className="hidden h-24 w-40 shrink-0 rounded-xl object-cover ring-1 ring-white/15 md:block"
          />
        )}
      </div>

      <div className="relative z-10 mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex gap-2 sm:gap-2.5" role="img" aria-label={`${used} of ${limit} seats in use`}>
          {Array.from({ length: limit }, (_, i) => (
            <Slot key={i} seat={seats[i]} index={i} />
          ))}
        </div>
        <div>
          <p className="font-serif text-xl">
            {used} of {limit} seats in use
          </p>
          <p className="mt-0.5 text-sm text-white/60">
            {open === 0 ? "No seats open" : open === 1 ? "1 seat open" : `${open} seats open`}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white" /> Joined
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-white/70 bg-white/10" /> Invited, not signed in yet
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-white/35" /> Open
        </span>
      </div>
    </section>
  );
}
