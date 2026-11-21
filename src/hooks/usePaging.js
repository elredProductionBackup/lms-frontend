"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_SIZE } from "@/lib/api";

/**
 * Page state for a list that uses the API's `start` / `offset` params
 * (start = records to skip, offset = page size).
 *
 *   const { items, page, status } = useAppSelector((s) => s.x);
 *   const paging = usePaging({ count: items.length, loading: status === "loading" });
 *   useEffect(() => {
 *     dispatch(fetchX({ start: paging.start, offset: paging.offset }));
 *   }, [paging.start, paging.offset]);
 *   ...
 *   <div ref={paging.listRef}>...rows...</div>
 *   <Pagination {...paging.props(page)} />
 *
 * - Call `paging.reset()` when a filter changes, to go back to page 1.
 * - If a page comes back empty (say the last row on the last page was
 *   removed), it steps back a page by itself.
 */
export function usePaging({ count = 0, loading = false, size = PAGE_SIZE } = {}) {
  const [start, setStart] = useState(0);
  const [offset, setOffset] = useState(size);
  const listRef = useRef(null);

  useEffect(() => {
    if (!loading && count === 0 && start > 0) setStart(Math.max(0, start - offset));
  }, [count, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring the top of the list back into view after a page change.
  const scrollToList = () => {
    const el = listRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: window.scrollY + top - 88, behavior: reduce ? "auto" : "smooth" });
    }
  };

  const goTo = useCallback((nextStart) => {
    setStart(Math.max(0, nextStart));
    scrollToList();
  }, []);

  const setSize = useCallback((nextSize) => {
    setOffset(nextSize);
    setStart(0);
  }, []);

  const reset = useCallback(() => setStart(0), []);

  const props = (page) => ({
    start,
    offset,
    count,
    total: page?.total ?? null,
    hasMore: Boolean(page?.hasMore),
    loading,
    onPageChange: goTo,
    onPageSizeChange: setSize,
  });

  return { start, offset, goTo, setSize, reset, listRef, props };
}
