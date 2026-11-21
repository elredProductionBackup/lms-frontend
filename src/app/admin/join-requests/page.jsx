"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, X, UserPlus, ChevronDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchJoinRequests, reviewJoinRequest } from "@/store/slices/joinRequestsSlice";
import { pushToast } from "@/store/slices/uiSlice";
import PageHeader from "@/components/admin/PageHeader";
import { Card, EmptyState } from "@/components/ui/Shell";
import { Button, Spinner } from "@/components/ui/Primitives";
import Pagination from "@/components/ui/Pagination";
import { usePaging } from "@/hooks/usePaging";
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
  const { items, page, status, reviewing } = useAppSelector((s) => s.joinRequests);
  const [expandedId, setExpandedId] = useState(null);
  const loading = status === "loading";
  const paging = usePaging({ count: items.length, loading });

  // GET /join-requests?start=&offset=  (all statuses, one page at a time)
  useEffect(() => {
    dispatch(fetchJoinRequests({ start: paging.start, offset: paging.offset }));
  }, [dispatch, paging.start, paging.offset]);

  const review = async (requestId, action) => {
    const res = await dispatch(reviewJoinRequest({ requestId, action }));
    if (reviewJoinRequest.fulfilled.match(res))
      dispatch(pushToast(action === "approve" ? "Request approved" : "Request rejected", "success"));
    else dispatch(pushToast(res.payload?.message || "Action failed", "error"));
  };

  const toggle = (id) => setExpandedId((cur) => (cur === id ? null : id));
  const pendingHere = items.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Join requests"
        description="People asking to join from the public catalog page. Approving adds them as a learner and sends them an acknowledgment email."
      />

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner size={26} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={UserPlus} title="No join requests" description="Requests from the public catalog page show up here." />
      ) : (
        <div ref={paging.listRef}>
          <Card className={`overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/8 px-6 py-4">
              <h2 className="font-serif text-lg text-ink">
                Requests
                {page.total != null && (
                  <span className="ml-2 align-middle font-sans text-sm font-normal text-ink-muted">{page.total}</span>
                )}
              </h2>
              {pendingHere > 0 && (
                <p className="text-sm text-ink-muted">
                  {pendingHere} waiting for review on this page
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Requested</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {items.map((r) => (
                    <Fragment key={r._id}>
                      <tr className="hover:bg-cream-100/60">
                        <td className="px-6 py-3">
                          <button
                            onClick={() => toggle(r._id)}
                            aria-expanded={expandedId === r._id}
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
                        <td className="whitespace-nowrap px-6 py-3 text-ink-muted">{formatDate(r.createdAt)}</td>
                        <td className="px-6 py-3"><StatusPill status={r.status} /></td>
                        <td className="px-6 py-3">
                          {r.status === "pending" ? (
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
                          ) : (
                            <p className="whitespace-nowrap text-right text-xs text-ink-muted">
                              {r.reviewedAt ? `Reviewed ${formatDate(r.reviewedAt)}` : "Reviewed"}
                            </p>
                          )}
                        </td>
                      </tr>
                      {expandedId === r._id && <DetailsRow r={r} cols={5} />}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination {...paging.props(page)} noun="requests" />
        </div>
      )}
    </div>
  );
}
