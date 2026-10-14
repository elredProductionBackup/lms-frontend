"use client";

// Custom calendar dropdown — no third-party date library, styled to the app's
// cream/ink/teal theme. Drop-in replacement for <input type="date"> and
// <input type="datetime-local">: it keeps the same value formats
// ("YYYY-MM-DD" and "YYYY-MM-DDTHH:mm") and calls onChange with a synthetic
// { target: { value } } event, so existing handlers keep working unchanged.
//
// Click the month or year in the calendar header to jump straight to it
// (handy for dates far away, like a date of birth).
//
// Optional props (all backwards compatible):
//   openTo="days" | "months" | "years"  – first view when no date is chosen
//   invalid, disabled, onBlur, aria-describedby – for form validation

import { useEffect, useId, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { fieldClass } from "@/components/ui/Field";

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
    Boolean(a && b) &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Keeps the day when possible: 31 Jan + 1 month -> 28/29 Feb.
function addMonths(d, n) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
}

const isBefore = (a, b) => toDateValue(a) < toDateValue(b);

function clampToRange(d, minDate, maxDate) {
  if (minDate && isBefore(d, minDate)) return minDate;
  if (maxDate && isBefore(maxDate, d)) return maxDate;
  return d;
}

// Build a 6x7 grid of days for the visible month, Monday-first.
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  // getDay(): 0=Sun..6=Sat -> convert to Monday-first offset (Mon=0..Sun=6)
  const lead = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - lead));
}

// --- shared open/close behaviour --------------------------------------------

function usePicker(onBlur) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // onBlur only when focus leaves the whole field (not when moving into the calendar).
  const handleBlur = (e) => {
    if (rootRef.current?.contains(e.relatedTarget)) return;
    onBlur?.(e);
  };

  return { open, setOpen, rootRef, triggerRef, closeAndFocus, handleBlur };
}

function PickerShell({
  picker,
  fieldId,
  label,
  hasValue,
  showClear,
  onClear,
  clearLabel,
  invalid,
  disabled,
  describedBy,
  className,
  children,
}) {
  const { open, setOpen, rootRef, triggerRef, handleBlur } = picker;
  return (
    <div ref={rootRef} className={`relative ${className}`} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={fieldClass({
          invalid,
          muted: !hasValue,
          className: `flex items-center gap-2 text-left ${showClear ? "pr-10" : ""} ${
            disabled ? "opacity-60" : "cursor-pointer"
          }`,
        })}
      >
        <Calendar size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <span className="flex-1 truncate">{label}</span>
      </button>

      {/* A real sibling button: a clickable element inside a <button> is invalid
          HTML and couldn't be reached with the keyboard. */}
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute left-0 z-50 mt-2 rounded-xl border border-ink/10 bg-white p-3 shadow-card animate-fade-in"
        >
          {children}
        </div>
      )}
    </div>
  );
}

// --- calendar ----------------------------------------------------------------

const navBtn =
  "rounded-lg p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50";
const headerBtn =
  "rounded-lg px-1.5 py-0.5 text-sm font-semibold text-ink hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50";
const cellBase =
  "flex items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50";

function cellTone({ isSel, off, outside }) {
  if (isSel) return "bg-teal font-semibold text-white";
  if (off) return "cursor-not-allowed text-ink-muted/40";
  if (outside) return "text-ink-muted/50 hover:bg-ink/5";
  return "text-ink hover:bg-ink/5";
}

function CalendarGrid({ selected, onPick, minDate, maxDate, openTo = "days" }) {
  const today = startOfToday();
  // Start on the selected date, or on today pulled into the allowed range.
  const [cursor, setCursor] = useState(() => selected || clampToRange(today, minDate, maxDate));
  const [view, setView] = useState(selected ? "days" : openTo);
  const gridRef = useRef(null);
  const focusCursor = useRef(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const pageStart = Math.floor(year / 12) * 12;

  const dayOff = (d) =>
    Boolean((minDate && isBefore(d, minDate)) || (maxDate && isBefore(maxDate, d)));
  const monthOff = (y, m) =>
    Boolean(
      (minDate && isBefore(new Date(y, m + 1, 0), minDate)) ||
        (maxDate && isBefore(maxDate, new Date(y, m, 1)))
    );
  const yearOff = (y) =>
    Boolean((minDate && y < minDate.getFullYear()) || (maxDate && y > maxDate.getFullYear()));

  const canGo = (dir) => {
    if (view === "days") return !monthOff(year, month + dir);
    if (view === "months") return !yearOff(year + dir);
    const s = pageStart + dir * 12;
    return !((minDate && s + 11 < minDate.getFullYear()) || (maxDate && s > maxDate.getFullYear()));
  };

  const go = (dir) => {
    if (!canGo(dir)) return;
    if (view === "days") setCursor((c) => clampToRange(addMonths(c, dir), minDate, maxDate));
    else if (view === "months") setCursor((c) => clampToRange(addMonths(c, dir * 12), minDate, maxDate));
    else setCursor((c) => new Date(c.getFullYear() + dir * 12, c.getMonth(), 1));
  };

  const pickMonth = (m) => {
    if (monthOff(year, m)) return;
    const keep = selected && selected.getFullYear() === year && selected.getMonth() === m;
    setCursor(clampToRange(keep ? selected : new Date(year, m, 1), minDate, maxDate));
    setView("days");
  };

  const pickYear = (y) => {
    if (yearOff(y)) return;
    setCursor(clampToRange(new Date(y, month, 1), minDate, maxDate));
    setView("months");
  };

  // Arrow keys move a day/week, PageUp/PageDown a month (Shift = a year).
  const onDaysKeyDown = (e) => {
    const deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = null;
    if (e.key in deltas) next = addDays(cursor, deltas[e.key]);
    else if (e.key === "PageUp") next = addMonths(cursor, e.shiftKey ? -12 : -1);
    else if (e.key === "PageDown") next = addMonths(cursor, e.shiftKey ? 12 : 1);
    if (!next) return;
    e.preventDefault();
    focusCursor.current = true;
    setCursor(clampToRange(next, minDate, maxDate));
  };

  useEffect(() => {
    if (!focusCursor.current) return;
    focusCursor.current = false;
    gridRef.current?.querySelector('[data-focused="true"]')?.focus();
  });

  const prevLabel = { days: "Previous month", months: "Previous year", years: "Previous years" }[view];
  const nextLabel = { days: "Next month", months: "Next year", years: "Next years" }[view];

  return (
    <div className="w-[17rem]">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} disabled={!canGo(-1)} className={navBtn} aria-label={prevLabel}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-0.5" aria-live="polite">
          {view === "days" && (
            <>
              <button type="button" className={headerBtn} onClick={() => setView("months")}>
                {MONTHS[month]}
              </button>
              <button type="button" className={headerBtn} onClick={() => setView("years")}>
                {year}
              </button>
            </>
          )}
          {view === "months" && (
            <button type="button" className={headerBtn} onClick={() => setView("years")}>
              {year}
            </button>
          )}
          {view === "years" && (
            <span className="px-1.5 text-sm font-semibold text-ink">
              {pageStart} – {pageStart + 11}
            </span>
          )}
        </div>

        <button type="button" onClick={() => go(1)} disabled={!canGo(1)} className={navBtn} aria-label={nextLabel}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {view === "days" && (
        <div ref={gridRef} onKeyDown={onDaysKeyDown}>
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1 text-center text-[11px] font-medium text-ink-muted">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthGrid(year, month).map((d) => {
              const isSel = sameDay(d, selected);
              const isToday = sameDay(d, today);
              const isFocused = sameDay(d, cursor);
              const off = dayOff(d);
              return (
                <button
                  key={toDateValue(d)}
                  type="button"
                  disabled={off}
                  tabIndex={isFocused ? 0 : -1}
                  data-focused={isFocused || undefined}
                  aria-pressed={isSel}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
                  onClick={() => onPick(d)}
                  className={[
                    `h-9 ${cellBase}`,
                    cellTone({ isSel, off, outside: d.getMonth() !== month }),
                    !isSel && isToday ? "ring-1 ring-inset ring-teal/50" : "",
                  ].join(" ")}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === "months" && (
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((name, m) => (
            <button
              key={name}
              type="button"
              disabled={monthOff(year, m)}
              aria-label={`${name} ${year}`}
              onClick={() => pickMonth(m)}
              className={`h-11 ${cellBase} ${cellTone({
                isSel: Boolean(selected) && selected.getFullYear() === year && selected.getMonth() === m,
                off: monthOff(year, m),
              })}`}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {view === "years" && (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => pageStart + i).map((y) => (
            <button
              key={y}
              type="button"
              disabled={yearOff(y)}
              onClick={() => pickYear(y)}
              className={`h-11 ${cellBase} ${cellTone({
                isSel: selected?.getFullYear() === y,
                off: yearOff(y),
              })}`}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- fields ------------------------------------------------------------------

export function DateField({
  value = "",
  onChange,
  onBlur,
  placeholder = "Select a date",
  min,
  max,
  required,
  disabled = false,
  invalid = false,
  openTo = "days",
  id,
  className = "",
  "aria-describedby": describedBy,
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const picker = usePicker(onBlur);
  const selected = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);
  const today = startOfToday();
  const todayAllowed = !(
    (minDate && isBefore(today, minDate)) ||
    (maxDate && isBefore(maxDate, today))
  );

  const emit = (v) => onChange?.({ target: { value: v, id: fieldId } });

  const pick = (d) => {
    emit(toDateValue(d));
    picker.closeAndFocus();
  };

  return (
    <PickerShell
      picker={picker}
      fieldId={fieldId}
      label={selected ? prettyDate(selected) : placeholder}
      hasValue={Boolean(selected)}
      showClear={Boolean(selected) && !required && !disabled}
      onClear={() => {
        emit("");
        picker.triggerRef.current?.focus();
      }}
      clearLabel="Clear date"
      invalid={invalid}
      disabled={disabled}
      describedBy={describedBy}
      className={className}
    >
      <CalendarGrid selected={selected} onPick={pick} minDate={minDate} maxDate={maxDate} openTo={openTo} />
      <div className="mt-2 flex justify-between border-t border-ink/8 pt-2">
        {todayAllowed ? (
          <button
            type="button"
            onClick={() => pick(today)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-teal hover:bg-teal/8"
          >
            Today
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={picker.closeAndFocus}
          className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-ink/5"
        >
          Done
        </button>
      </div>
    </PickerShell>
  );
}

export function DateTimeField({
  value = "",
  onChange,
  onBlur,
  placeholder = "Select date & time",
  min,
  max,
  required,
  disabled = false,
  invalid = false,
  openTo = "days",
  id,
  className = "",
  "aria-describedby": describedBy,
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const picker = usePicker(onBlur);

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
  // If a time is set before a day, use today — but only if today is allowed.
  const pickTime = (e) =>
    emit(datePart || toDateValue(clampToRange(startOfToday(), minDate, maxDate)), e.target.value);

  const label = selected
    ? `${prettyDate(selected)}${time ? ` · ${time}` : ""}`
    : placeholder;

  return (
    <PickerShell
      picker={picker}
      fieldId={fieldId}
      label={label}
      hasValue={Boolean(selected)}
      showClear={Boolean(selected) && !required && !disabled}
      onClear={() => {
        emit("", "");
        picker.triggerRef.current?.focus();
      }}
      clearLabel="Clear date and time"
      invalid={invalid}
      disabled={disabled}
      describedBy={describedBy}
      className={className}
    >
      <CalendarGrid selected={selected} onPick={pickDay} minDate={minDate} maxDate={maxDate} openTo={openTo} />
      <div className="mt-2 flex items-center gap-2 border-t border-ink/8 pt-2.5">
        <Clock size={15} aria-hidden="true" className="text-ink-muted" />
        <input
          type="time"
          value={time}
          onChange={pickTime}
          aria-label="Time"
          className="flex-1 rounded-lg border border-ink/15 bg-cream-50 px-2.5 py-1.5 text-sm text-ink focus:border-teal focus:bg-white focus:outline-none"
        />
        <button
          type="button"
          onClick={picker.closeAndFocus}
          className="rounded-lg px-2 py-1 text-xs font-medium text-teal hover:bg-teal/8"
        >
          Done
        </button>
      </div>
    </PickerShell>
  );
}