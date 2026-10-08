"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, X, UserPlus, ChevronDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchJoinRequests, reviewJoinRequest } from "@/store/slices/joinRequestsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/Shell";
import { Button, Spinner } from "@/components/ui/Primitives";
import { formatDate } from "@/lib/format";

const DETAIL_FIELDS = [
  ["phone", "Phone"],
  ["userName", "Username"],
  ["gender", "Gender"],
  ["dob", "Date of birth"],
  ["profession", "Profession"],
  ["organizationType", "Organization type"],
  ["companyType", "Company type"],
  ["companyDisplayName", "Company"],
  ["industry", "Industry"],
];

function StatusPill({ status }) {
  const map = {
    pending: "bg-general/15 text-general-dark",
    approved: "bg-available/12 text-available",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
        map[status] || "bg-ink/8 text-ink-muted"
      }`}
    >
      {status}
    </span>
  );
}

function DetailsRow({ r, cols }) {
  const location = [r.location?.city, r.location?.state, r.location?.country]
    .filter(Boolean)
    .join(", ");
  return (
    <tr>
      <td colSpan={cols} className="bg-cream-100/60 px-6 py-4">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
          {DETAIL_FIELDS.map(([key, label]) => (
            <Detail key={key} label={label} value={r[key]} />
          ))}
          <Detail label="Location" value={location} />
          <Detail label="Organization URL" value={r.organizationUrl} link />
          <Detail label="LinkedIn URL" value={r.linkedInUrl} link />
        </div>
      </td>
    </tr>
  );
}

function Detail({ label, value, link }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
      {link && value ? (
        <a href={value} target="_blank" rel="noreferrer" className="block truncate text-teal hover:underline">
          {value}
        </a>
      ) : (
        <div className="text-ink-soft">{value || "—"}</div>
      )}
    </div>
  );
}

export default function JoinRequestsPage() {
  const dispatch = useAppDispatch();
  const { items, status, reviewing } = useAppSelector((s) => s.joinRequests);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    dispatch(fetchJoinRequests());
  }, [dispatch]);

  const review = async (requestId, action) => {
    const res = await dispatch(reviewJoinRequest({ requestId, action }));
    if (reviewJoinRequest.fulfilled.match(res))
      dispatch(pushToast(action === "approve" ? "Request approved" : "Request rejected", "success"));
    else dispatch(pushToast(res.payload?.message || "Action failed", "error"));
  };

  const toggle = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const pending = items.filter((r) => r.status === "pending");
  const reviewed = items.filter((r) => r.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Join requests"
        description="People asking to join from the public catalog page. Approving adds them as a learner and sends them an acknowledgment email."
      />

      {status === "loading" ? (
        <div className="flex justify-center py-16"><Spinner size={26} /></div>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-ink/8 px-6 py-4">
              <h2 className="font-serif text-lg text-ink">Pending ({pending.length})</h2>
            </div>
            {pending.length === 0 ? (
              <div className="px-6 py-10 text-sm text-ink-muted">No pending requests.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Requested</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {pending.map((r) => (
                    <Fragment key={r._id}>
                      <tr className="hover:bg-cream-100/60">
                        <td className="px-6 py-3">
                          <button
                            onClick={() => toggle(r._id)}
                            className="inline-flex items-center gap-2 font-medium text-ink"
                          >
                            <ChevronDown
                              size={16}
                              className={`text-ink-muted transition-transform ${expandedId === r._id ? "rotate-180" : ""}`}
                            />
                            {r.name}
                          </button>
                        </td>
                        <td className="px-6 py-3 text-ink-muted">{r.email}</td>
                        <td className="px-6 py-3 text-ink-muted">{formatDate(r.createdAt)}</td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="teal"
                              loading={reviewing === r._id}
                              onClick={() => review(r._id, "approve")}
                            >
                              <Check size={15} /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={reviewing === r._id}
                              onClick={() => review(r._id, "reject")}
                            >
                              <X size={15} /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === r._id && <DetailsRow r={r} cols={4} />}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {reviewed.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-ink/8 px-6 py-4">
                <h2 className="font-serif text-lg text-ink">Reviewed</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Reviewed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {reviewed.map((r) => (
                    <Fragment key={r._id}>
                      <tr className="hover:bg-cream-100/60">
                        <td className="px-6 py-3">
                          <button
                            onClick={() => toggle(r._id)}
                            className="inline-flex items-center gap-2 font-medium text-ink"
                          >
                            <ChevronDown
                              size={16}
                              className={`text-ink-muted transition-transform ${expandedId === r._id ? "rotate-180" : ""}`}
                            />
                            {r.name}
                          </button>
                        </td>
                        <td className="px-6 py-3 text-ink-muted">{r.email}</td>
                        <td className="px-6 py-3"><StatusPill status={r.status} /></td>
                        <td className="px-6 py-3 text-ink-muted">
                          {r.reviewedAt ? formatDate(r.reviewedAt) : "—"}
                        </td>
                      </tr>
                      {expandedId === r._id && <DetailsRow r={r} cols={4} />}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
