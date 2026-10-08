"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { dismissToast } from "@/store/slices/uiSlice";

function Toast({ toast }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), 4200);
    return () => clearTimeout(t);
  }, [toast.id, dispatch]);

  const meta = {
    success: { Icon: CheckCircle2, cls: "text-available" },
    error: { Icon: AlertCircle, cls: "text-red-600" },
    default: { Icon: Info, cls: "text-teal" },
  }[toast.tone] || { Icon: Info, cls: "text-teal" };
  const { Icon, cls } = meta;

  return (
    <div className="flex w-80 items-start gap-3 rounded-xl border border-ink/10 bg-cream-50 px-4 py-3 shadow-card animate-fade-in">
      <Icon size={18} className={`mt-0.5 shrink-0 ${cls}`} strokeWidth={1.75} />
      <p className="flex-1 text-sm text-ink">{toast.message}</p>
      <button
        onClick={() => dispatch(dismissToast(toast.id))}
        className="text-ink-muted hover:text-ink"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default function ToastHost() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}
