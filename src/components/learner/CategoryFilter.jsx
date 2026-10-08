"use client";

const FILTERS = [
  { value: "all", label: "All sessions" },
  { value: "frontend", label: "Frontend" },
  { value: "general", label: "General" },
  { value: "backend", label: "Backend" },
];

export default function CategoryFilter({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {FILTERS.map((f) => {
        const on = active === f.value;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
              on
                ? "bg-ink text-cream-50"
                : "border border-ink/15 bg-cream-50 text-ink hover:bg-cream-200"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
