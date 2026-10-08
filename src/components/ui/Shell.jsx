"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Card({ children, className = "", as: Tag = "div", ...props }) {
  return (
    <Tag
      className={`rounded-card border border-ink/8 bg-cream-50 shadow-soft ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} animate-fade-in rounded-card border border-ink/10 bg-cream-50 shadow-card`}
      >
        <div className="flex items-center justify-between border-b border-ink/8 px-6 py-4">
          <h2 className="font-serif text-xl text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-ink/15 bg-cream-100/50 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-200 text-ink-muted">
          <Icon size={22} strokeWidth={1.5} />
        </span>
      )}
      <p className="font-serif text-lg text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-ink/10">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors ${
            active === t.value
              ? "text-teal"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {t.label}
          {active === t.value && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-teal" />
          )}
        </button>
      ))}
    </div>
  );
}
