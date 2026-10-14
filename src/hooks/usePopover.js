"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Calls onDismiss when the user presses anywhere outside `ref` while open.
export function useDismiss(ref, open, onDismiss) {
  const cb = useRef(onDismiss);
  cb.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cb.current?.();
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [ref, open]);
}

// Opens the popover upwards when there isn't room below the anchor.
export function usePlacement(anchorRef, open, popoverHeight = 300) {
  const [placement, setPlacement] = useState("bottom");

  useIsoLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setPlacement(below < popoverHeight && rect.top > below ? "top" : "bottom");
  }, [open, anchorRef, popoverHeight]);

  return placement;
}