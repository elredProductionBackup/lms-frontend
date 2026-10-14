"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { fieldClass } from "@/components/ui/Field";
import { useDismiss, usePlacement } from "@/hooks/usePopover";

/**
 * Reusable dropdown that looks like the other inputs.
 *
 * <Dropdown
 *   value={form.gender}
 *   onChange={(value) => ...}          // receives the option value, not an event
 *   options={[{ value: "male", label: "Male" }, "Other"]}   // objects or plain strings
 *   placeholder="Select gender"
 * />
 *
 * Keyboard: ↑ ↓ Home End to move, Enter/Space to pick, Esc to close,
 * type letters to jump to an option (works while closed too).
 */
const normalize = (options) =>
  options.map((o) =>
    typeof o === "object" && o !== null
      ? { value: o.value, label: o.label ?? String(o.value), disabled: Boolean(o.disabled) }
      : { value: o, label: String(o), disabled: false }
  );

export function Dropdown({
  id,
  name,
  value,
  onChange,
  onBlur,
  options = [],
  placeholder = "Select…",
  invalid = false,
  disabled = false,
  className = "",
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
}) {
  const items = normalize(options);
  const autoId = useId();
  const baseId = id || autoId;
  const listId = `${baseId}-listbox`;
  const optionId = (i) => `${baseId}-option-${i}`;

  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ text: "", timer: null });

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const selectedIndex = items.findIndex((o) => o.value === value);
  const selected = items[selectedIndex];
  const placement = usePlacement(buttonRef, open, 264);

  useDismiss(rootRef, open, () => setOpen(false));

  useEffect(() => () => clearTimeout(typeahead.current.timer), []);

  // Keep the highlighted option visible while moving with the keyboard.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // Next enabled index in a direction; stays put at the ends.
  const step = (from, dir) => {
    for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
      if (!items[i].disabled) return i;
    }
    return from;
  };
  const firstIndex = () => step(-1, 1);
  const lastIndex = () => step(items.length, -1);

  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : firstIndex());
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (i) => {
    const item = items[i];
    if (!item || item.disabled) return;
    if (item.value !== value) onChange?.(item.value);
    close();
  };

  const findByText = (char) => {
    const t = typeahead.current;
    clearTimeout(t.timer);
    t.text += char.toLowerCase();
    t.timer = setTimeout(() => (t.text = ""), 500);
    const start = open ? active : selectedIndex;
    // A single repeated letter cycles through matches.
    const from = start < 0 ? 0 : start + (t.text.length === 1 ? 1 : 0);
    for (let n = 0; n < items.length; n++) {
      const i = (from + n) % items.length;
      if (!items[i].disabled && items[i].label.toLowerCase().startsWith(t.text)) return i;
    }
    return -1;
  };

  const isPrintable = (e) => e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey;

  const onKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      } else if (isPrintable(e)) {
        const i = findByText(e.key);
        if (i >= 0 && items[i].value !== value) onChange?.(items[i].value);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => step(a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(firstIndex());
        break;
      case "End":
        e.preventDefault();
        setActive(lastIndex());
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation(); // don't close a parent modal
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (isPrintable(e)) {
          const i = findByText(e.key);
          if (i >= 0) setActive(i);
        }
    }
  };

  // Fires onBlur only when focus leaves the whole component.
  const handleBlur = (e) => {
    if (rootRef.current?.contains(e.relatedTarget)) return;
    setOpen(false);
    onBlur?.(e);
  };

  return (
    <div ref={rootRef} className="relative" onBlur={handleBlur}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      <button
        ref={buttonRef}
        id={baseId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={fieldClass({
          invalid,
          muted: !selected,
          className: `flex items-center justify-between gap-2 pr-3 text-left ${
            disabled ? "opacity-60" : "cursor-pointer"
          } ${className}`,
        })}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-ink-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          // Keep focus on the button so the keyboard keeps working after a click.
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute left-0 right-0 z-50 max-h-64 overflow-auto rounded-xl border border-ink/10 bg-white p-1 shadow-lg ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {items.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">No options</li>
          )}
          {items.map((item, i) => {
            const isSelected = i === selectedIndex;
            const isActive = i === active;
            return (
              <li
                key={`${item.value}`}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={item.disabled || undefined}
                data-index={i}
                onMouseEnter={() => !item.disabled && setActive(i)}
                onClick={() => choose(i)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                  item.disabled ? "cursor-not-allowed text-ink-muted/50" : "cursor-pointer text-ink"
                } ${isActive && !item.disabled ? "bg-cream-100" : ""} ${isSelected ? "font-medium" : ""}`}
              >
                <span className="truncate">{item.label}</span>
                {isSelected && <Check size={15} aria-hidden="true" className="shrink-0 text-teal" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default Dropdown;