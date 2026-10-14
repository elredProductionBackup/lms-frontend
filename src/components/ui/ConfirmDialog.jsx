"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Primitives";

/**
 * Promise-based confirmation popup. No provider needed:
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   const ok = await confirm({
 *     title: "Delete this comment?",
 *     message: "This can't be undone.",
 *     confirmLabel: "Delete",
 *     // Optional. The dialog stays open with a spinner while this runs, and
 *     // shows the error inline if it throws (e.g. RTK's .unwrap()).
 *     action: () => dispatch(deleteComment(id)).unwrap(),
 *   });
 *   ...
 *   return <>{dialog}...</>;
 *
 * Resolves true once confirmed (and the action succeeded), false if cancelled.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options = {}) => new Promise((resolve) => setRequest({ options, resolve })),
    []
  );

  const close = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  const dialog = request ? <ConfirmDialog {...request.options} onClose={close} /> : null;
  return { confirm, dialog };
}

export function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  action,
  onClose,
}) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus Cancel first (safer for destructive actions), lock page scroll,
  // and hand focus back to whatever opened the dialog when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    panelRef.current?.querySelector("[data-autofocus]")?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, []);

  const cancel = () => {
    if (!busy) onCloseRef.current?.(false);
  };

  const accept = async () => {
    if (!action) return onCloseRef.current?.(true);
    setBusy(true);
    setError(null);
    try {
      await action();
      onCloseRef.current?.(true);
    } catch (e) {
      setError(e?.message || "That didn't work. Try again.");
      setBusy(false);
    }
  };

  // Esc cancels; Tab stays inside the dialog.
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll("button:not([disabled])");
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const danger = tone === "danger";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-ink/40 animate-fade-in" aria-hidden="true" onClick={cancel} />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-sm rounded-card border border-ink/10 bg-cream-50 p-5 shadow-card animate-fade-in"
      >
        <div className="flex gap-3">
          {danger && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-lg leading-snug text-ink">
              {title}
            </h2>
            {message && (
              <p id={messageId} className="mt-1 text-sm leading-relaxed text-ink-soft">
                {message}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={cancel} disabled={busy} data-autofocus>
            {cancelLabel}
          </Button>
          <Button size="sm" variant={danger ? "danger" : "teal"} onClick={accept} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmDialog;