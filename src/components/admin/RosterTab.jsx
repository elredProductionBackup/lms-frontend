"use client";

import { useEffect, useState } from "react";
import { Users, SlidersHorizontal } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchCourseRoster } from "@/store/slices/coursesSlice";
import { updateEnrollmentWindow } from "@/store/slices/subscriptionsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { Card, Modal, EmptyState } from "@/components/ui/Shell";
import { Button, Avatar, Badge, Spinner } from "@/components/ui/Primitives";
import { Input, Select, Fieldset } from "@/components/ui/Field";
import { DateTimeField } from "@/components/ui/DatePicker";
import { formatDay } from "@/lib/format";

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function RosterTab({ course }) {
  const dispatch = useAppDispatch();
  const roster = useAppSelector((s) => s.courses.roster);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const courseId = course._id;

  useEffect(() => {
    setLoading(true);
    dispatch(fetchCourseRoster(courseId)).finally(() => setLoading(false));
  }, [courseId, dispatch]);

  const isActive = (e) => {
    if (e.revoked) return false;
    if (e.forceStatus === "open") return true;
    if (e.forceStatus === "closed") return false;
    const now = Date.now();
    const start = e.startAt ? new Date(e.startAt).getTime() : -Infinity;
    const end = e.endAt ? new Date(e.endAt).getTime() : Infinity;
    return now >= start && now <= end;
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;

  if (roster.length === 0) {
    return <EmptyState icon={Users} title="No enrollees" description="Assign seats under Subscriptions to enroll learners." />;
  }

  return (
    <div>
      <Card className="divide-y divide-ink/8">
        {roster.map((e) => (
          <div key={e.enrollmentId} className="flex items-center gap-4 px-5 py-3.5">
            <Avatar name={e.name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{e.name || "—"}</p>
              <p className="truncate text-sm text-ink-muted">{e.email}</p>
            </div>
            <div className="hidden text-right text-xs text-ink-muted sm:block">
              {formatDay(e.startAt)} → {formatDay(e.endAt)}
            </div>
            <Badge tone={e.revoked ? "archived" : isActive(e) ? "published" : "closed"}>
              {e.revoked ? "revoked" : isActive(e) ? "active" : e.forceStatus === "closed" ? "closed" : "expired"}
            </Badge>
            <button
              onClick={() => setEditing(e)}
              className="rounded-lg p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
              aria-label="Edit window"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        ))}
      </Card>

      {editing && (
        <WindowModal
          enrollment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            dispatch(fetchCourseRoster(courseId));
          }}
        />
      )}
    </div>
  );
}

function WindowModal({ enrollment, onClose, onSaved }) {
  const dispatch = useAppDispatch();
  const [start, setStart] = useState(toLocalInput(enrollment.startAt));
  const [end, setEnd] = useState(toLocalInput(enrollment.endAt));
  const [forceStatus, setForceStatus] = useState(enrollment.forceStatus || "auto");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const patch = { forceStatus };
    if (start) patch.startAt = new Date(start).toISOString();
    if (end) patch.endAt = new Date(end).toISOString();
    const res = await dispatch(
      updateEnrollmentWindow({ enrollmentId: enrollment.enrollmentId, patch })
    );
    setSaving(false);
    if (updateEnrollmentWindow.fulfilled.match(res)) {
      dispatch(pushToast("Access window updated", "success"));
      onSaved();
    } else {
      dispatch(pushToast(res.payload?.message || "Could not update", "error"));
    }
  };

  return (
    <Modal open onClose={onClose} title={`Access · ${enrollment.name || enrollment.email}`}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Fieldset label="Starts">
            <DateTimeField value={start} onChange={(e) => setStart(e.target.value)} max={end || undefined} />
          </Fieldset>
          <Fieldset label="Ends">
            <DateTimeField value={end} onChange={(e) => setEnd(e.target.value)} min={start || undefined} />
          </Fieldset>
        </div>
        <Fieldset label="Override" hint="auto respects the window">
          <Select value={forceStatus} onChange={(e) => setForceStatus(e.target.value)}>
            <option value="auto">Auto (use window)</option>
            <option value="open">Force open</option>
            <option value="closed">Force closed</option>
          </Select>
        </Fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="teal" onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
