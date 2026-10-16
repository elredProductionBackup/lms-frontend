"use client";

import { useEffect, useState } from "react";
import { Plus, Ticket, XCircle, Pause, Play } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchSubscriptions,
  createSubscription,
  updateSubscription,
  revokeSeat,
} from "@/store/slices/subscriptionsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { Card, Modal, EmptyState } from "@/components/ui/Shell";
import { Button, Badge, Spinner } from "@/components/ui/Primitives";
import { Input, Select, Textarea, Fieldset } from "@/components/ui/Field";
import { DateTimeField } from "@/components/ui/DatePicker";
import AssignSeatForm from "@/components/admin/AssignSeatForm";
import SeatPerson from "@/components/admin/SeatPerson";
import { formatDay, clock } from "@/lib/format";

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function SubscriptionsTab({ course }) {
  const dispatch = useAppDispatch();
  const { items, status, mutating } = useAppSelector((s) => s.subscriptions);
  const [showCreate, setShowCreate] = useState(false);
  const courseId = course._id;

  useEffect(() => {
    dispatch(fetchSubscriptions(courseId));
  }, [courseId, dispatch]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Subscriptions grant learner access. Single = 1 seat, Enterprise = many.
        </p>
        <Button variant="teal" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New subscription
        </Button>
      </div>

      {status === "loading" ? (
        <div className="flex justify-center py-16"><Spinner size={26} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Ticket} title="No subscriptions" description="Create one to start assigning seats." />
      ) : (
        <div className="space-y-4">
          {items.map((sub) => (
            <SubscriptionCard key={sub._id} sub={sub} courseId={courseId} mutating={mutating} />
          ))}
        </div>
      )}

      <CreateSubscriptionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        courseId={courseId}
        mutating={mutating}
      />
    </div>
  );
}

function SubscriptionCard({ sub, courseId, mutating }) {
  const dispatch = useAppDispatch();
  const activeSeats = (sub.seats || []).filter((s) => s.status === "active");
  const suspended = sub.status === "suspended";

  const revoke = async (seatEmail) => {
    const res = await dispatch(revokeSeat({ id: sub._id, email: seatEmail }));
    if (revokeSeat.fulfilled.match(res)) dispatch(pushToast("Seat revoked", "success"));
  };

  const toggleSuspend = async () => {
    const res = await dispatch(
      updateSubscription({ id: sub._id, patch: { status: suspended ? "active" : "suspended" } })
    );
    if (updateSubscription.fulfilled.match(res))
      dispatch(pushToast(suspended ? "Reactivated" : "Suspended", "success"));
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink/8 bg-cream-100/60 px-5 py-3.5">
        <span className="font-mono text-sm font-medium text-ink">{sub.subscriptionCode}</span>
        <Badge tone={sub.type === "enterprise" ? "admin" : "author"}>{sub.type}</Badge>
        <Badge tone={suspended ? "archived" : "published"}>{sub.status}</Badge>
        <span className="text-sm text-ink-muted">
          {activeSeats.length} / {sub.seatLimit} seats
        </span>
        <span className="ml-auto text-xs text-ink-muted">
          {formatDay(sub.accessStartAt)} → {formatDay(sub.accessEndAt)}
        </span>
        <Button size="sm" variant={suspended ? "outline" : "ghost"} onClick={toggleSuspend}>
          {suspended ? <><Play size={14} /> Reactivate</> : <><Pause size={14} /> Suspend</>}
        </Button>
      </div>

      <div className="px-5 py-4">
        {!suspended && activeSeats.length < sub.seatLimit && (
          <div className="mb-4">
            <AssignSeatForm
              subscriptionId={sub._id}
              onAssigned={() => dispatch(fetchSubscriptions(courseId))}
            />
          </div>
        )}

        {(sub.seats || []).length === 0 ? (
          <p className="text-sm text-ink-muted">No seats assigned yet.</p>
        ) : (
          <div className="space-y-1.5">
            {sub.seats.map((seat) => (
              <div
                key={seat.email + seat.status}
                className="flex items-center gap-3 rounded-lg bg-cream-100 px-3 py-2"
              >
                <span className={`h-2 w-2 rounded-full ${seat.status === "active" ? "bg-available" : "bg-ink/30"}`} />
                <span className="min-w-0 flex-1 text-sm">
                  <SeatPerson seat={seat} />
                </span>
                {seat.progress && (
                  <span className="text-xs text-ink-muted">
                    {seat.progress.videoTitle || "watching"} · {clock(seat.progress.positionSeconds)}
                  </span>
                )}
                <span className="text-xs capitalize text-ink-muted">{seat.status}</span>
                {seat.status === "active" && (
                  <button
                    onClick={() => revoke(seat.email)}
                    className="text-ink-muted hover:text-red-600"
                    aria-label="Revoke seat"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function CreateSubscriptionModal({ open, onClose, courseId, mutating }) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({
    type: "enterprise",
    subscriptionCode: "",
    subscriptionDetails: "",
    seatLimit: 5,
    accessStartAt: "",
    accessEndAt: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      type: form.type,
      subscriptionCode: form.subscriptionCode,
      subscriptionDetails: form.subscriptionDetails,
      accessStartAt: new Date(form.accessStartAt).toISOString(),
      accessEndAt: new Date(form.accessEndAt).toISOString(),
    };
    if (form.type === "enterprise") body.seatLimit = Number(form.seatLimit);
    const res = await dispatch(createSubscription({ courseId, body }));
    if (createSubscription.fulfilled.match(res)) {
      dispatch(pushToast("Subscription created", "success"));
      onClose();
      setForm({ type: "enterprise", subscriptionCode: "", subscriptionDetails: "", seatLimit: 5, accessStartAt: "", accessEndAt: "" });
    } else {
      dispatch(pushToast(res.payload?.message || "Could not create", "error"));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New subscription">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Fieldset label="Type">
            <Select value={form.type} onChange={set("type")}>
              <option value="enterprise">Enterprise (multi-seat)</option>
              <option value="single">Single (1 seat)</option>
            </Select>
          </Fieldset>
          <Fieldset label="Seat limit" hint={form.type === "single" ? "fixed at 1" : ""}>
            <Input
              type="number"
              min={1}
              value={form.type === "single" ? 1 : form.seatLimit}
              onChange={set("seatLimit")}
              disabled={form.type === "single"}
            />
          </Fieldset>
        </div>
        <Fieldset label="Subscription code" hint="unique, e.g. payment ID">
          <Input required value={form.subscriptionCode} onChange={set("subscriptionCode")} className="font-mono" />
        </Fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Fieldset label="Access starts">
            <DateTimeField required value={form.accessStartAt} onChange={set("accessStartAt")} max={form.accessEndAt || undefined} />
          </Fieldset>
          <Fieldset label="Access ends">
            <DateTimeField required value={form.accessEndAt} onChange={set("accessEndAt")} min={form.accessStartAt || undefined} />
          </Fieldset>
        </div>
        <Fieldset label="Details" hint="optional">
          <Textarea rows={2} value={form.subscriptionDetails} onChange={set("subscriptionDetails")} />
        </Fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="teal" loading={mutating}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
