"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, AlertCircle, PauseCircle } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  fetchMyTeam,
  addTeamSeats,
  replaceTeamSeat,
  removeTeamSeat,
  selectPlan,
} from "@/store/slices/teamSlice";
import { pushToast } from "@/store/slices/uiSlice";
import RouteGuard from "@/components/auth/RouteGuard";
import TopNav from "@/components/learner/TopNav";
import SiteFooter from "@/components/learner/SiteFooter";
import { Card, EmptyState } from "@/components/ui/Shell";
import { Button, Spinner } from "@/components/ui/Primitives";
import { Select } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import PlanCard from "@/components/team/PlanCard";
import InviteForm from "@/components/team/InviteForm";
import SeatList from "@/components/team/SeatList";
import ReplaceSeatModal from "@/components/team/ReplaceSeatModal";
import { formatDay } from "@/lib/format";

const SUPPORT_EMAIL = "info@theprofessionals.network";

// The buyer of an enterprise plan hands its seats to colleagues by email.
// Data: GET /my/subscriptions (store/slices/teamSlice.js).
function TeamInner() {
  const dispatch = useAppDispatch();
  const { plans, selectedId, status, refreshing, error, assigning, busyEmail } = useAppSelector((s) => s.team);
  const { confirm, dialog } = useConfirm();
  const [replacing, setReplacing] = useState(null);

  // Called every time the page opens.
  useEffect(() => {
    dispatch(fetchMyTeam());
  }, [dispatch]);

  const plan = plans.find((p) => p.id === selectedId) || plans[0] || null;
  const seats = plan?.seats || [];
  const takenEmails = useMemo(() => new Set(seats.map((s) => s.email.toLowerCase())), [seats]);
  const openSeats = plan ? plan.seatsAvailable ?? Math.max(0, plan.seatLimit - seats.length) : 0;
  const readOnly = plan ? plan.status !== "active" : true;
  const courseTitle = plan?.course?.title;

  const refresh = () => dispatch(fetchMyTeam({ silent: true }));

  // Resolves to the refused emails ([] if all were added), or null when the
  // request itself failed, so the form keeps what was typed.
  const onAssign = async (emails) => {
    const res = await dispatch(addTeamSeats({ subscriptionId: plan.id, emails }));
    if (!addTeamSeats.fulfilled.match(res)) {
      dispatch(pushToast(res.payload?.message || "Seats weren't added. Try again.", "error"));
      return null;
    }
    const results = res.payload.results;
    const added = results.filter((r) => r.ok);
    const failed = results
      .filter((r) => !r.ok)
      .map((r) => ({ email: r.email, message: r.error?.message || "Couldn't be added" }));

    if (added.length === 1) dispatch(pushToast(`Seat added. We emailed ${added[0].email}.`, "success"));
    else if (added.length > 1) dispatch(pushToast(`${added.length} seats added. Invites are on their way.`, "success"));
    if (failed.length) {
      dispatch(
        pushToast(
          failed.length === 1 ? `${failed[0].email} wasn't added. See the reason below.` : `${failed.length} emails weren't added. See the reasons below.`,
          "error"
        )
      );
    }
    if (added.length) refresh();
    return failed;
  };

  const onReplace = async (newEmail) => {
    const seat = replacing;
    const res = await dispatch(replaceTeamSeat({ subscriptionId: plan.id, email: seat.email, newEmail }));
    if (!replaceTeamSeat.fulfilled.match(res)) return res.payload?.message || "The seat wasn't replaced. Try again.";
    setReplacing(null);
    dispatch(pushToast(`Seat moved to ${newEmail}. We've emailed them an invite.`, "success"));
    refresh();
    return null;
  };

  const onRemove = async (seat) => {
    const who = seat.name?.trim() || seat.email;
    const ok = await confirm({
      title: `Remove ${who}?`,
      message: `${seat.email} loses access to ${courseTitle || "this course"} right away, and the seat opens for someone else.`,
      confirmLabel: "Remove",
      action: () => dispatch(removeTeamSeat({ subscriptionId: plan.id, email: seat.email })).unwrap(),
    });
    if (ok) {
      dispatch(pushToast(`${who} removed. 1 seat is open.`, "success"));
      refresh();
    }
  };

  let body;
  if (status === "idle" || status === "loading") {
    body = (
      <div className="flex justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  } else if (status === "error") {
    body = (
      <EmptyState
        icon={AlertCircle}
        title="Your team couldn't be loaded"
        description={error}
        action={<Button variant="outline" onClick={() => dispatch(fetchMyTeam())}>Try again</Button>}
      />
    );
  } else if (!plan) {
    body = (
      <EmptyState
        icon={Users}
        title="No team plan on this account"
        description="Team seats show up here when you buy an enterprise plan for a course."
        action={
          <Link
            href="/home"
            className="inline-flex items-center justify-center rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Back to sessions
          </Link>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-6">
        {plans.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="team-plan" className="text-sm font-medium text-ink-soft">Plan</label>
            <div className="min-w-0 flex-1 sm:max-w-md">
              <Select id="team-plan" value={plan.id} onChange={(e) => dispatch(selectPlan(e.target.value))}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.course?.title || p.subscriptionCode} ({p.seatsUsed ?? p.seats?.length ?? 0}/{p.seatLimit} seats)
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <PlanCard plan={plan} />

        {readOnly ? (
          <Card className="flex items-start gap-4 p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream-200 text-ink-muted">
              <PauseCircle size={18} strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="font-serif text-lg text-ink">This plan is {plan.status}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Seats can&apos;t be added or changed right now. Write to{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
                  {SUPPORT_EMAIL}
                </a>{" "}
                if you think this is a mistake.
              </p>
            </div>
          </Card>
        ) : (
          <InviteForm
            key={plan.id}
            openSeats={openSeats}
            takenEmails={takenEmails}
            assigning={assigning}
            onAssign={onAssign}
            supportEmail={SUPPORT_EMAIL}
          />
        )}

        <SeatList
          plan={plan}
          busyEmail={busyEmail}
          readOnly={readOnly}
          refreshing={refreshing}
          onReplace={setReplacing}
          onRemove={onRemove}
        />

        <p className="px-1 text-xs leading-relaxed text-ink-muted">
          People sign in with the email you add here, using an email code or Google.{" "}
          {plan.isLifetime ? "Access doesn't expire." : `Everyone's access ends on ${formatDay(plan.accessEndAt)}.`}{" "}
          Plan reference <span className="break-all font-mono text-ink-soft">{plan.subscriptionCode}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-5 sm:py-10">
        <header className="mb-6 sm:mb-8">
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">My team</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Give your seats to colleagues by email. You can swap people any time.
          </p>
        </header>
        {body}
      </main>
      <SiteFooter />
      <ReplaceSeatModal
        seat={replacing}
        courseTitle={courseTitle}
        takenEmails={takenEmails}
        onClose={() => setReplacing(null)}
        onConfirm={onReplace}
      />
      {dialog}
    </div>
  );
}

export default function TeamPage() {
  return (
    <RouteGuard>
      <TeamInner />
    </RouteGuard>
  );
}
