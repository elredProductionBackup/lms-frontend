"use client";

import { useEffect, useId, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Modal } from "@/components/ui/Shell";
import { Button } from "@/components/ui/Primitives";
import { Input, Fieldset } from "@/components/ui/Field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Swap the person on a seat for someone else.
// onConfirm(newEmail) resolves to null on success, or an error message.
export default function ReplaceSeatModal({ seat, courseTitle, takenEmails, onClose, onConfirm }) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue("");
    setError("");
    setBusy(false);
  }, [seat?.email]);

  if (!seat) return null;
  const who = seat.name?.trim() || seat.email;

  const submit = async (e) => {
    e.preventDefault();
    const newEmail = value.trim().toLowerCase();
    if (!EMAIL_RE.test(newEmail)) return setError("Enter a valid email address.");
    if (newEmail === seat.email) return setError("That's the email already on this seat.");
    if (takenEmails.has(newEmail)) return setError("This person already has a seat on your plan.");
    setBusy(true);
    const problem = await onConfirm(newEmail);
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <Modal open onClose={busy ? undefined : onClose} title={`Replace ${who}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-ink-soft">
          {seat.email} loses access to {courseTitle || "this course"} right away. The new person gets an
          invite email and takes over this seat.
        </p>
        <Fieldset label="New person's email" htmlFor={inputId} error={error}>
          <Input
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="off"
            autoFocus
            value={value}
            invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
            placeholder="name@company.com"
          />
        </Fieldset>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="teal" loading={busy} disabled={!value.trim()}>
            {!busy && <ArrowLeftRight size={15} />} Replace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
