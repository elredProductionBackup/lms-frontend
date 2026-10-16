"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Lock, LockOpen, Trash2, Pencil } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchSubscriptions,
  createSubscription,
  updateSubscription,
  revokeSeat,
  clearSubscriptions,
} from "@/store/slices/subscriptionsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { api } from "@/lib/api";
import { clock } from "@/lib/format";
import PageHeader from "@/components/admin/PageHeader";
import { Card, EmptyState } from "@/components/ui/Shell";
import { Button, Badge, Spinner } from "@/components/ui/Primitives";
import { Input, Textarea, Fieldset } from "@/components/ui/Field";
import { DateField } from "@/components/ui/DatePicker";
import AssignSeatForm from "@/components/admin/AssignSeatForm";
import SeatPerson from "@/components/admin/SeatPerson";

function toDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
function defaultFrom() {
  return toDateInputValue(new Date());
}
function defaultTo() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return toDateInputValue(d);
}

export default function CourseSubscriptionsPage() {
  const { id: courseId } = useParams();
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((s) => s.subscriptions);
  const [course, setCourse] = useState(null);

  const reload = () => dispatch(fetchSubscriptions(courseId));

  useEffect(() => {
    if (!courseId) return;
    api.get(`/courses/${courseId}`).then(setCourse).catch(() => {});
    reload();
    return () => {
      dispatch(clearSubscriptions());
    };
  }, [courseId, dispatch]);

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <PageHeader
        title={`Subscriptions${course ? `: ${course.title}` : ""}`}
        description="Manage subscriptions and seats for this course."
      />

      <div className="space-y-6">
        <AddSubscriptionForm courseId={courseId} onAdded={reload} />

        {status === "loading" && items.length === 0 ? (
          <div className="flex justify-center py-16"><Spinner size={26} /></div>
        ) : items.length === 0 ? (
          <EmptyState title="No subscriptions yet" description="No subscriptions yet for this course." />
        ) : (
          <div className="space-y-5">
            {items.map((sub) => (
              <SubscriptionCard key={sub._id} sub={sub} onChanged={reload} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypeToggle({ type, onChange }) {
  const opt = (value, label) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        type === value
          ? "bg-ink text-cream-50"
          : "border border-ink/15 bg-cream-50 text-ink hover:bg-cream-200"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-2">
      {opt("single", "Single")}
      {opt("enterprise", "Enterprise")}
    </div>
  );
}

function AddSubscriptionForm({ courseId, onAdded }) {
  const dispatch = useAppDispatch();
  const { mutating } = useAppSelector((s) => s.subscriptions);
  const [type, setType] = useState("single");
  const [seatLimit, setSeatLimit] = useState("5");
  const [subscriptionCode, setSubscriptionCode] = useState("");
  const [subscriptionDetails, setSubscriptionDetails] = useState("");
  const [accessStartAt, setAccessStartAt] = useState(defaultFrom());
  const [accessEndAt, setAccessEndAt] = useState(defaultTo());

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      type,
      subscriptionCode: subscriptionCode.trim(),
      accessStartAt: new Date(accessStartAt).toISOString(),
      accessEndAt: new Date(accessEndAt).toISOString(),
    };
    if (type === "enterprise") body.seatLimit = Number(seatLimit) || 5;
    if (subscriptionDetails.trim()) body.subscriptionDetails = subscriptionDetails.trim();

    const res = await dispatch(createSubscription({ courseId, body }));
    if (createSubscription.fulfilled.match(res)) {
      dispatch(pushToast("Subscription added", "success"));
      setSubscriptionCode("");
      setSubscriptionDetails("");
      setSeatLimit("5");
      setType("single");
      setAccessStartAt(defaultFrom());
      setAccessEndAt(defaultTo());
      onAdded();
    } else {
      dispatch(pushToast(res.payload?.message || "Could not add subscription", "error"));
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-serif text-lg text-ink">Add subscription</h2>
      <form onSubmit={submit} className="space-y-4">
        <TypeToggle type={type} onChange={setType} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Fieldset label="Subscription code">
            <Input
              required
              value={subscriptionCode}
              onChange={(e) => setSubscriptionCode(e.target.value)}
              placeholder="External payment ID"
            />
          </Fieldset>
          {type === "enterprise" && (
            <Fieldset label="Seat limit">
              <Input type="number" min="1" value={seatLimit} onChange={(e) => setSeatLimit(e.target.value)} />
            </Fieldset>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Fieldset label="Access from">
            <DateField required value={accessStartAt} onChange={(e) => setAccessStartAt(e.target.value)} max={accessEndAt || undefined} />
          </Fieldset>
          <Fieldset label="Access to">
            <DateField required value={accessEndAt} onChange={(e) => setAccessEndAt(e.target.value)} min={accessStartAt || undefined} />
          </Fieldset>
        </div>

        <p className="text-[13px] text-ink-muted">
          Every seat assigned on this subscription gets this exact access window — it&apos;s a template, so
          changing it later only affects seats assigned from then on.
        </p>

        <Fieldset label="Details">
          <Textarea
            rows={2}
            value={subscriptionDetails}
            onChange={(e) => setSubscriptionDetails(e.target.value)}
            placeholder="Optional notes about this subscription"
          />
        </Fieldset>

        <div>
          <Button type="submit" variant="teal" loading={mutating}>
            <Plus size={16} /> Add subscription
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProgressCell({ progress }) {
  if (!progress) return <span className="text-xs text-ink-muted">Not started</span>;
  const pct = progress.durationSeconds
    ? Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100))
    : null;
  return (
    <div className="text-[12.5px]">
      {progress.videoTitle && <div className="text-[11px] text-ink-muted">{progress.videoTitle}</div>}
      <div className="text-ink-soft">
        {clock(progress.positionSeconds)}
        {progress.durationSeconds ? ` / ${clock(progress.durationSeconds)}` : ""}
        {pct != null ? ` (${pct}%)` : ""}
      </div>
      <div className="text-[11px] text-ink-muted">{new Date(progress.updatedAt).toLocaleString()}</div>
    </div>
  );
}

function SubscriptionCard({ sub, onChanged }) {
  const dispatch = useAppDispatch();
  const [seatLimitDraft, setSeatLimitDraft] = useState(String(sub.seatLimit));
  const [accessStartAtDraft, setAccessStartAtDraft] = useState(toDateInputValue(sub.accessStartAt));
  const [accessEndAtDraft, setAccessEndAtDraft] = useState(toDateInputValue(sub.accessEndAt));
  const [busy, setBusy] = useState(false);
  const [revokingEmail, setRevokingEmail] = useState(null);

  // Re-sync drafts if the subscription is reloaded from the server.
  useEffect(() => {
    setSeatLimitDraft(String(sub.seatLimit));
    setAccessStartAtDraft(toDateInputValue(sub.accessStartAt));
    setAccessEndAtDraft(toDateInputValue(sub.accessEndAt));
  }, [sub.seatLimit, sub.accessStartAt, sub.accessEndAt]);

  const seats = sub.seats || [];
  const activeSeats = seats.filter((s) => s.status === "active");
  const suspended = sub.status === "suspended";
  const windowChanged =
    accessStartAtDraft !== toDateInputValue(sub.accessStartAt) ||
    accessEndAtDraft !== toDateInputValue(sub.accessEndAt);

  const patch = async (body, okMsg) => {
    setBusy(true);
    const res = await dispatch(updateSubscription({ id: sub._id, patch: body }));
    setBusy(false);
    if (updateSubscription.fulfilled.match(res)) {
      if (okMsg) dispatch(pushToast(okMsg, "success"));
      onChanged();
      return true;
    }
    dispatch(pushToast(res.payload?.message || "Update failed", "error"));
    return false;
  };

  const saveWindow = () =>
    patch(
      {
        accessStartAt: new Date(accessStartAtDraft).toISOString(),
        accessEndAt: new Date(accessEndAtDraft).toISOString(),
      },
      "Access window saved"
    );

  const saveSeatLimit = () => patch({ seatLimit: Number(seatLimitDraft) }, "Seat limit saved");

  const toggleStatus = async () => {
    if (!suspended) {
      const ok = window.confirm(
        "Suspending this subscription immediately revokes every enrollment it provisioned. Continue?"
      );
      if (!ok) return;
    }
    await patch({ status: suspended ? "active" : "suspended" }, suspended ? "Reactivated" : "Suspended");
  };

  const revoke = async (email) => {
    if (!window.confirm(`Revoke the seat for ${email}?`)) return;
    setRevokingEmail(email);
    const res = await dispatch(revokeSeat({ id: sub._id, email }));
    setRevokingEmail(null);
    if (revokeSeat.fulfilled.match(res)) {
      dispatch(pushToast("Seat revoked", "success"));
      onChanged();
    } else {
      dispatch(pushToast(res.payload?.message || "Could not revoke", "error"));
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="admin">{sub.type === "enterprise" ? "Enterprise" : "Single"}</Badge>
            <span className="font-mono font-semibold text-ink">{sub.subscriptionCode}</span>
            <Badge tone={suspended ? "closed" : "available"}>{suspended ? "Suspended" : "Active"}</Badge>
          </div>
          {sub.subscriptionDetails && (
            <p className="mt-1.5 text-sm text-ink-muted">{sub.subscriptionDetails}</p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Badge>{activeSeats.length} / {sub.seatLimit} seats</Badge>
          <Button variant="outline" size="sm" disabled={busy} onClick={toggleStatus}>
            {suspended ? (<><LockOpen size={14} /> Reactivate</>) : (<><Lock size={14} /> Suspend</>)}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Fieldset label="Access from">
            <DateField value={accessStartAtDraft} onChange={(e) => setAccessStartAtDraft(e.target.value)} max={accessEndAtDraft || undefined} />
          </Fieldset>
        </div>
        <div className="w-40">
          <Fieldset label="Access to">
            <DateField value={accessEndAtDraft} onChange={(e) => setAccessEndAtDraft(e.target.value)} min={accessStartAtDraft || undefined} />
          </Fieldset>
        </div>
        <Button variant="outline" size="sm" disabled={busy || !windowChanged} onClick={saveWindow}>
          <Pencil size={14} /> Save window
        </Button>
        <span className="pb-2 text-xs text-ink-muted">
          Template only — changing this affects seats assigned from now on, not seats already provisioned.
        </span>
      </div>

      {sub.type === "enterprise" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36">
            <Fieldset label="Seat limit">
              <Input type="number" min="1" value={seatLimitDraft} onChange={(e) => setSeatLimitDraft(e.target.value)} />
            </Fieldset>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || Number(seatLimitDraft) === sub.seatLimit}
            onClick={saveSeatLimit}
          >
            Save
          </Button>
          <span className="pb-2 text-xs text-ink-muted">
            Lowering the limit below the current assigned count won&apos;t revoke anyone — it just blocks new
            assignments until the count drops.
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-ink/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/8 bg-cream-100/60 text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2.5 font-medium">Learner</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Current state</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/8">
            {seats.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-ink-muted">No seats assigned yet.</td>
              </tr>
            ) : (
              seats.map((seat) => (
                <tr key={seat._id || seat.email}>
                  <td className="max-w-[18rem] px-4 py-2.5">
                    <SeatPerson seat={seat} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={seat.status === "revoked" ? "archived" : "available"}>{seat.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5"><ProgressCell progress={seat.progress} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {seat.status === "active" && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={revokingEmail === seat.email}
                        onClick={() => revoke(seat.email)}
                      >
                        <Trash2 size={14} /> Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-medium text-ink-soft">Assign seat</p>
        <AssignSeatForm subscriptionId={sub._id} disabled={suspended} onAssigned={onChanged} />
        {suspended && (
          <p className="mt-1.5 text-xs text-ink-muted">Reactivate this subscription before assigning new seats.</p>
        )}
      </div>
    </Card>
  );
}
