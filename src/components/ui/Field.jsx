"use client";

import { ChevronDown } from "lucide-react";

export function Label({ children, htmlFor, hint }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-soft">
      {children}
      {hint && <span className="ml-1.5 font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

// Border and text colours are chosen conditionally (not stacked) so Tailwind's
// CSS order can't make the wrong one win.
const baseField =
  "w-full rounded-xl border bg-cream-50 px-3.5 py-2.5 text-sm placeholder:text-ink-muted/70 transition-colors focus:bg-white focus:outline-none disabled:cursor-not-allowed";

// Shared by Input, Textarea, Select, Dropdown and DateField so they all match.
export function fieldClass({ invalid = false, muted = false, className = "" }) {
  const border = invalid ? "border-red-400 focus:border-red-500" : "border-ink/15 focus:border-teal";
  const text = muted ? "text-ink-muted/70" : "text-ink";
  return `${baseField} ${border} ${text} ${className}`;
}

export function Input({ className = "", invalid = false, ...props }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={fieldClass({ invalid, className })}
      {...props}
    />
  );
}

export function Textarea({ className = "", rows = 3, invalid = false, ...props }) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={fieldClass({ invalid, className: `resize-y ${className}` })}
      {...props}
    />
  );
}

// appearance-none removes the browser's own arrow (which sat at a different
// position on every OS); we draw one chevron, vertically centred.
export function Select({ className = "", invalid = false, placeholder, value, children, ...props }) {
  const showingPlaceholder = Boolean(placeholder) && (value === "" || value == null);
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        aria-invalid={invalid || undefined}
        className={fieldClass({
          invalid,
          muted: showingPlaceholder,
          className: `cursor-pointer appearance-none pr-10 [&>option]:text-ink ${className}`,
        })}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

export function Fieldset({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      {label && (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}