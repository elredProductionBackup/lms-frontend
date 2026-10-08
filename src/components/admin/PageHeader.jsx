"use client";

export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
