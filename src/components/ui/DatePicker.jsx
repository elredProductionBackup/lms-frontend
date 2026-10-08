"use client";

// Custom calendar dropdown — no third-party date library, styled to the app's
// cream/ink/teal theme. Drop-in replacement for <input type="date"> and
// <input type="datetime-local">: it keeps the same value formats
// ("YYYY-MM-DD" and "YYYY-MM-DDTHH:mm") and calls onChange with a synthetic
// { target: { value } } event, so existing handlers keep working unchanged.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");

// --- format helpers (all local-time, no UTC drift) -------------------------

function parseDate(value) {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toDateValue(dt) {
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function prettyDate(dt) {
  return `${MONTHS[dt.getMonth()].slice(0, 3)} ${dt.getDate()}, ${dt.getFullYear()}`;
}

function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Build a 6x7 grid of days for the visible month, Monday-first.
function monthGrid(view) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  // getDay(): 0=Sun..6=Sat -> convert to Monday-first offset (Mon=0..Sun=6)
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// ---------------------------------------------------------------------------

const triggerCls =
  "flex w-full items-center gap-2 rounded-xl border border-ink/15 bg-cream-50 px-3.5 py-2.5 text-left text-sm text-ink transition-colors focus:border-teal focus:bg-white focus:outline-none";

function useOutsideClose(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return ref;
}

function CalendarGrid({ selected, onPick, minDate, maxDate }) {
  const [view, setView] = useState(
    () => selected || new Date()
  );
  const days = useMemo(() => monthGrid(view), [view]);
  const today = new Date();

  const disabled = (d) =>
    (minDate && toDateValue(d) < toDateValue(minDate)) ||
    (maxDate && toDateValue(d) > toDateValue(maxDate));

  return (
    <div className="w-[17rem]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="rounded-lg p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-ink">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="rounded-lg p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-center text-[11px] font-medium text-ink-muted">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const outside = d.getMonth() !== view.getMonth();
          const isSel = sameDay(d, selected);
          const isToday = sameDay(d, today);
          const off = disabled(d);
          return (
            <button
              key={i}
              type="button"
              disabled={off}
              onClick={() => onPick(d)}
              className={[
                "flex h-9 items-center justify-center rounded-lg text-sm transition-colors",
                isSel
                  ? "bg-teal font-semibold text-white"
                  : off
                  ? "cursor-not-allowed text-ink-muted/40"
                  : outside
                  ? "text-ink-muted/50 hover:bg-ink/5"
                  : "text-ink hover:bg-ink/5",
                !isSel && isToday ? "ring-1 ring-inset ring-teal/50" : "",
              ].join(" ")}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateField({
  value = "",
  onChange,
  placeholder = "Select a date",
  min,
  max,
  required,
  id,
  className = "",
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, setOpen);
  const selected = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);

  const emit = (v) => onChange?.({ target: { value: v, id: fieldId } });

  const pick = (d) => {
    emit(toDateValue(d));
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        id={fieldId}
        onClick={() => setOpen((o) => !o)}
        className={triggerCls}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={16} className="shrink-0 text-ink-muted" />
        <span className={selected ? "flex-1 text-ink" : "flex-1 text-ink-muted/70"}>
          {selected ? prettyDate(selected) : placeholder}
        </span>
        {selected && !required && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              emit("");
            }}
            className="rounded p-0.5 text-ink-muted hover:text-ink"
            aria-label="Clear date"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 rounded-xl border border-ink/10 bg-white p-3 shadow-card animate-fade-in">
          <CalendarGrid selected={selected} onPick={pick} minDate={minDate} maxDate={maxDate} />
          <div className="mt-2 flex justify-between border-t border-ink/8 pt-2">
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="rounded-lg px-2 py-1 text-xs font-medium text-teal hover:bg-teal/8"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-ink/5"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DateTimeField({
  value = "",
  onChange,
  placeholder = "Select date & time",
  min,
  max,
  required,
  id,
  className = "",
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, setOpen);

  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const selected = parseDate(datePart);
  const time = /^\d{2}:\d{2}/.test(timePart || "") ? timePart.slice(0, 5) : "";
  const minDate = parseDate(min);
  const maxDate = parseDate(max);

  const emit = (dateStr, timeStr) => {
    if (!dateStr) return onChange?.({ target: { value: "", id: fieldId } });
    const t = timeStr || "00:00";
    onChange?.({ target: { value: `${dateStr}T${t}`, id: fieldId } });
  };

  const pickDay = (d) => emit(toDateValue(d), time || "09:00");
  const pickTime = (e) => emit(datePart || toDateValue(new Date()), e.target.value);

  const label = selected
    ? `${prettyDate(selected)}${time ? ` · ${time}` : ""}`
    : placeholder;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        id={fieldId}
        onClick={() => setOpen((o) => !o)}
        className={triggerCls}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={16} className="shrink-0 text-ink-muted" />
        <span className={selected ? "flex-1 text-ink" : "flex-1 text-ink-muted/70"}>
          {label}
        </span>
        {selected && !required && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              emit("", "");
            }}
            className="rounded p-0.5 text-ink-muted hover:text-ink"
            aria-label="Clear"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 rounded-xl border border-ink/10 bg-white p-3 shadow-card animate-fade-in">
          <CalendarGrid selected={selected} onPick={pickDay} minDate={minDate} maxDate={maxDate} />
          <div className="mt-2 flex items-center gap-2 border-t border-ink/8 pt-2.5">
            <Clock size={15} className="text-ink-muted" />
            <input
              type="time"
              value={time}
              onChange={pickTime}
              className="flex-1 rounded-lg border border-ink/15 bg-cream-50 px-2.5 py-1.5 text-sm text-ink focus:border-teal focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-teal hover:bg-teal/8"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
