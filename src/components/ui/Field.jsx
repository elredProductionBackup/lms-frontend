"use client";

export function Label({ children, htmlFor, hint }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-soft">
      {children}
      {hint && <span className="ml-1.5 font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

const baseField =
  "w-full rounded-xl border border-ink/15 bg-cream-50 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 transition-colors focus:border-teal focus:bg-white focus:outline-none";

export function Input({ className = "", ...props }) {
  return <input className={`${baseField} ${className}`} {...props} />;
}

export function Textarea({ className = "", rows = 3, ...props }) {
  return <textarea rows={rows} className={`${baseField} resize-y ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`${baseField} pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Fieldset({ label, hint, children, htmlFor }) {
  return (
    <div>
      {label && (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      )}
      {children}
    </div>
  );
}
