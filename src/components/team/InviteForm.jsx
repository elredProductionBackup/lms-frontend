"use client";

import { useId, useRef, useState } from "react";
import { X, Send, Mail } from "lucide-react";
import { Card } from "@/components/ui/Shell";
import { Button } from "@/components/ui/Primitives";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SPLIT_RE = /[\s,;]+/;

// Each chip is checked against the format, the other chips, people who
// already hold a seat, how many seats are open, and any reason the server
// gave last time it was sent.
function checkChips(chips, takenEmails, openSeats, serverErrors = {}) {
  const seen = new Set();
  let valid = 0;
  return chips.map((email) => {
    if (serverErrors[email]) return { email, error: serverErrors[email] };
    if (!EMAIL_RE.test(email)) return { email, error: "Not a valid email" };
    if (seen.has(email)) return { email, error: "Added twice" };
    seen.add(email);
    if (takenEmails.has(email)) return { email, error: "Already has a seat" };
    valid += 1;
    if (valid > openSeats) return { email, error: "No seat left for this one" };
    return { email, error: null };
  });
}

const lowerFirst = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

// onAssign(emails) resolves to the emails the server refused:
//   [{ email, message }]  (empty when every one was added)
export default function InviteForm({ openSeats, takenEmails, assigning, onAssign, supportEmail, disabled = false }) {
  const inputId = useId();
  const helpId = useId();
  const inputRef = useRef(null);
  const [chips, setChips] = useState([]);
  const [draft, setDraft] = useState("");
  const [serverErrors, setServerErrors] = useState({});

  const checked = checkChips(chips, takenEmails, openSeats, serverErrors);
  const errors = checked.filter((c) => c.error);
  const ready = checked.filter((c) => !c.error);

  const addFrom = (text) => {
    const parts = text
      .split(SPLIT_RE)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length) setChips((c) => [...c, ...parts]);
  };

  const commitDraft = () => {
    if (draft.trim()) addFrom(draft);
    setDraft("");
  };

  const onKeyDown = (e) => {
    if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && draft.trim()) {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Enter") {
      e.preventDefault();
    } else if (e.key === "Backspace" && !draft && chips.length) {
      setChips((c) => c.slice(0, -1));
    }
  };

  const onPaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (SPLIT_RE.test(text.trim())) {
      e.preventDefault();
      addFrom(text);
    }
  };

  const removeAt = (i) => {
    const email = chips[i];
    setServerErrors(({ [email]: _gone, ...rest }) => rest);
    setChips((c) => c.filter((_, idx) => idx !== i));
    inputRef.current?.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    // Include whatever is still typed in the box.
    const all = draft.trim() ? [...chips, ...draft.split(SPLIT_RE).map((p) => p.trim().toLowerCase()).filter(Boolean)] : chips;
    const finalCheck = checkChips(all, takenEmails, openSeats, serverErrors);
    setChips(all);
    setDraft("");
    if (finalCheck.length === 0 || finalCheck.some((c) => c.error)) return;
    const failed = await onAssign(finalCheck.map((c) => c.email));
    if (!failed) return; // request didn't go through; keep everything as typed
    // Keep only the refused emails, each showing the server's reason.
    setChips(failed.map((f) => f.email));
    setServerErrors(Object.fromEntries(failed.map((f) => [f.email, f.message || "Couldn't be added"])));
  };

  if (openSeats === 0) {
    return (
      <Card className="flex items-start gap-4 p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream-200 text-ink-muted">
          <Mail size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-serif text-lg text-ink">All seats are in use</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Remove someone below to free a seat, or write to{" "}
            <a href={`mailto:${supportEmail}`} className="font-medium text-teal hover:underline">
              {supportEmail}
            </a>{" "}
            to add more seats to your plan.
          </p>
        </div>
      </Card>
    );
  }

  // A finished email still sitting in the box counts toward the button label.
  const typed = draft.trim().toLowerCase();
  const typedCounts =
    EMAIL_RE.test(typed) && !takenEmails.has(typed) && !chips.includes(typed) && ready.length < openSeats;
  const count = ready.length + (typedCounts ? 1 : 0);
  const label = count > 1 ? `Assign ${count} seats` : "Assign seat";

  return (
    <Card className="p-6">
      <form onSubmit={submit} noValidate>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg text-ink">Add people</h2>
          <p className="text-sm text-ink-muted">
            {openSeats === 1 ? "1 seat open" : `${openSeats} seats open`}
          </p>
        </div>

        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-soft">
          Work emails
        </label>
        <div
          onClick={() => inputRef.current?.focus()}
          className={`flex min-h-[46px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border bg-cream-50 px-2 py-1.5 transition-colors focus-within:bg-white ${
            errors.length ? "border-red-400 focus-within:border-red-500" : "border-ink/15 focus-within:border-teal"
          }`}
        >
          {checked.map((c, i) => (
            <span
              key={`${c.email}-${i}`}
              title={c.error || undefined}
              className={`inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-sm ${
                c.error ? "border border-red-200 bg-red-50 text-red-700" : "bg-cream-200 text-ink"
              }`}
            >
              <span className="truncate">{c.email}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
                className="rounded-full p-0.5 opacity-60 transition-opacity hover:bg-ink/10 hover:opacity-100"
                aria-label={`Remove ${c.email}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={commitDraft}
            disabled={assigning || disabled}
            placeholder={chips.length ? "" : "name@company.com"}
            aria-describedby={helpId}
            className="min-w-[10rem] flex-1 bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
            style={{ outline: "none" }}
          />
        </div>

        <div id={helpId} className="mt-1.5 min-h-[1.25rem] text-xs" aria-live="polite">
          {errors.length > 0 ? (
            <ul className="space-y-0.5 text-red-600">
              {errors.map((c, i) => (
                <li key={`${c.email}-${i}`}>
                  {c.email}: {lowerFirst(c.error)}
                  {c.error === "No seat left for this one" ? ". Remove an email to continue." : ""}
                  {serverErrors[c.email] ? ". Remove it to send the rest." : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">
              Separate emails with a comma or press Enter. You can paste a list.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            Each person gets an email and signs in with that address.
          </p>
          <Button
            type="submit"
            variant="teal"
            loading={assigning}
            disabled={disabled || (count === 0 && !draft.trim()) || errors.length > 0}
            className="shrink-0"
          >
            {!assigning && <Send size={15} />}
            {label}
          </Button>
        </div>
      </form>
    </Card>
  );
}
