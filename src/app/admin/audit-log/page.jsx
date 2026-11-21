"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, ScrollText, RotateCcw } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { fetchAuditLog, fetchAuditActions } from "@/store/slices/adminSlice";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/ui/Pagination";
import { usePaging } from "@/hooks/usePaging";
import { Card, Modal, EmptyState } from "@/components/ui/Shell";
import { Button, Badge, Spinner } from "@/components/ui/Primitives";
import { Input, Select, Fieldset } from "@/components/ui/Field";
import { DateField } from "@/components/ui/DatePicker";
import { formatDate } from "@/lib/format";

const EMPTY_FILTERS = { action: "", actorEmail: "", from: "", to: "" };

// Mirror the proto: "to" is inclusive of the whole day, not midnight-start.
function normalizeFilters(filters) {
  const clean = {};
  if (filters.action) clean.action = filters.action;
  if (filters.actorEmail.trim()) clean.actorEmail = filters.actorEmail.trim();
  if (filters.from) clean.from = new Date(filters.from).toISOString();
  if (filters.to) {
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    clean.to = end.toISOString();
  }
  return clean;
}

export default function AuditLogPage() {
  const dispatch = useAppDispatch();
  const { entries, auditPage, actions, auditStatus } = useAppSelector((s) => s.admin);
  const loading = auditStatus === "loading";
  const paging = usePaging({ count: entries.length, loading });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    dispatch(fetchAuditActions());
  }, [dispatch]);

  // GET /audit-log?action=&actorEmail=&from=&to=&start=&offset=
  useEffect(() => {
    dispatch(fetchAuditLog({ ...normalizeFilters(applied), start: paging.start, offset: paging.offset }));
  }, [dispatch, applied, paging.start, paging.offset]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const apply = (e) => {
    e.preventDefault();
    setApplied(filters);
    paging.reset();
  };
  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    paging.reset();
  };

  const hasActiveFilters = useMemo(() => Object.values(applied).some(Boolean), [applied]);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description={hasActiveFilters ? "Filtered results, newest first." : "Every event, newest first."}
      />

      <Card className="mb-5 p-5" as="form" onSubmit={apply}>
        <div className="grid gap-3 sm:grid-cols-4">
          <Fieldset label="Action">
            <Select value={filters.action} onChange={set("action")}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </Fieldset>
          <Fieldset label="Actor email">
            <Input value={filters.actorEmail} onChange={set("actorEmail")} placeholder="Search by email" />
          </Fieldset>
          <Fieldset label="From">
            <DateField value={filters.from} onChange={set("from")} placeholder="Any start date" max={filters.to || undefined} />
          </Fieldset>
          <Fieldset label="To">
            <DateField value={filters.to} onChange={set("to")} placeholder="Any end date" min={filters.from || undefined} />
          </Fieldset>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit" variant="teal" size="sm">
            <Filter size={15} /> Apply filters
          </Button>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw size={15} /> Clear filters
            </Button>
          )}
        </div>
      </Card>

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner size={26} /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={ScrollText} title="No entries" description="No events match these filters." />
      ) : (
        <div ref={paging.listRef}>
        <Card className={`overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/8 text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3 font-medium">Timestamp</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {entries.map((e) => (
                <tr key={e._id} className="hover:bg-cream-100/60">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-soft">
                    {formatDate(e.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-ink">
                    {e.actorId ? (
                      <>
                        {e.actorId.name || ""}{" "}
                        <span className="text-ink-muted">&lt;{e.actorId.email}&gt;</span>
                      </>
                    ) : (
                      <span className="text-ink-muted">system</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge>{e.action}</Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{e.targetType}</td>
                  <td className="px-5 py-3 text-right">
                    {e.meta && Object.keys(e.meta).length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setDetail(e)}>
                        View details
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
        <Pagination {...paging.props(auditPage)} noun="events" />
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.action || "Details"}>
        {detail && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              {formatDate(detail.createdAt)} · {detail.actorId ? detail.actorId.email : "system"}
            </p>
            <pre className="thin-scroll overflow-x-auto rounded-xl bg-cream-100 p-3.5 font-mono text-xs text-ink-soft">
              {JSON.stringify(detail.meta, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
