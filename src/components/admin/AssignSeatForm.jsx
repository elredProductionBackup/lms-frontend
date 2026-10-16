"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useAppDispatch } from "@/hooks/redux";
import { assignSeat } from "@/store/slices/subscriptionsSlice";
import { PERSON_NAME_MAX } from "@/store/slices/membersSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { Button } from "@/components/ui/Primitives";
import { Input } from "@/components/ui/Field";

// POST /subscriptions/:id/seats { email, displayName? }
//   -> { subscription, enrollment, user: { id, name, email } }
// The display name is used only when this creates the person's account. If
// they already had one, it's ignored and user.name is their existing name,
// so we say so. Empty name -> the backend uses the part of the email before @.
export default function AssignSeatForm({ subscriptionId, disabled = false, onAssigned }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const typed = name.trim();
    if (!cleanEmail || busy) return;

    setBusy(true);
    const res = await dispatch(assignSeat({ id: subscriptionId, email: cleanEmail, displayName: typed }));
    setBusy(false);

    if (!assignSeat.fulfilled.match(res)) {
      dispatch(pushToast(res.payload?.message || "Seat wasn't assigned. Try again.", "error"));
      return;
    }

    const used = res.payload?.user?.name?.trim() || "";
    if (typed && used && used !== typed) {
      dispatch(
        pushToast(`Seat added for ${used} (existing account). Their name stays as it is.`, "default")
      );
    } else {
      dispatch(pushToast(`Seat assigned to ${used || typed || cleanEmail}`, "success"));
    }
    setName("");
    setEmail("");
    onAssigned?.();
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={PERSON_NAME_MAX}
          disabled={disabled}
          placeholder="Display name (optional)"
          aria-label="Display name for a new person"
          autoComplete="off"
          className="sm:max-w-[15rem]"
        />
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled}
          placeholder="learner@email.com"
          aria-label="Learner email"
          autoComplete="off"
          className="sm:flex-1"
        />
        <Button type="submit" variant="teal" size="sm" disabled={disabled} loading={busy} className="shrink-0 sm:py-2.5">
          <UserPlus size={14} /> Assign seat
        </Button>
      </div>
      <p className="text-xs text-ink-muted">
        The name is used for new people only. Someone who already has an account keeps their name.
      </p>
    </form>
  );
}
