"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { PAGE_SIZE } from "@/lib/api";

const SIZES = [10, 20, 50];

// 1 … 4 5 6 … 12 around the current page.
function pageList(current, last) {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= last - 2) [last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

/**
 * Pager for lists that use `start` (records to skip) and `offset` (page size).
 * Shows numbered pages when the API sends a `total`; otherwise previous/next.
 * Use with hooks/usePaging: <Pagination {...paging.props(page)} />
 */
export default function Pagination({
  start,
  offset,
  count,
  total = null,
  hasMore,
  loading = false,
  onPageChange,
  onPageSizeChange,
  noun = "results",
  className = "",
}) {
  const hasTotal = Number.isFinite(total);
  const current = Math.floor(start / offset) + 1;
  const last = hasTotal ? Math.max(1, Math.ceil(total / offset)) : null;
  const canPrev = start > 0;
  const canNext = hasTotal ? current < last : hasMore;

  // One page at the default size: nothing to page through.
  if (!canPrev && !canNext && offset === PAGE_SIZE) return null;

  const from = count > 0 ? start + 1 : 0;
  const to = start + count;
  const go = (page) => onPageChange((page - 1) * offset);

  const arrow =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-cream-50 text-ink transition-colors hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cream-50";

  return (
    <nav
      aria-label="Pagination"
      className={`mt-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
        <span aria-live="polite">
          {count === 0
            ? `No ${noun}`
            : hasTotal
              ? `Showing ${from}–${to} of ${total}`
              : `Showing ${from}–${to}`}
        </span>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={offset}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="cursor-pointer rounded-lg border border-ink/15 bg-cream-50 px-2 py-1 text-sm text-ink focus:border-teal focus:outline-none"
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {loading && <Loader2 size={15} className="animate-spin" aria-label="Loading" />}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={!canPrev || loading}
          className={arrow}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {hasTotal ? (
          <>
            <span className="px-2 text-sm text-ink-muted sm:hidden">
              Page {current} of {last}
            </span>
            <ul className="hidden items-center gap-1 sm:flex">
              {pageList(current, last).map((p) =>
                typeof p === "string" ? (
                  <li key={p} className="px-1 text-sm text-ink-muted" aria-hidden>
                    …
                  </li>
                ) : (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => go(p)}
                      disabled={loading}
                      aria-current={p === current ? "page" : undefined}
                      aria-label={`Page ${p}`}
                      className={`h-9 min-w-[2.25rem] rounded-full px-2.5 text-sm font-medium transition-colors ${
                        p === current ? "bg-ink text-cream-50" : "text-ink-soft hover:bg-ink/5"
                      }`}
                    >
                      {p}
                    </button>
                  </li>
                )
              )}
            </ul>
          </>
        ) : (
          <span className="px-2 text-sm text-ink-muted">Page {current}</span>
        )}

        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={!canNext || loading}
          className={arrow}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
