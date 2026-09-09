"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { useAnchoredOverlay } from "@/components/ui/use-anchored-overlay";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

type SelectChangeEvent = { target: { value: string; name?: string } };

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (event: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  options?: SelectOption[];
  className?: string;
  menuClassName?: string;
  wrapperClassName?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) {
    return textOf((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function parseOptionChildren(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const type = child.type;
    const isOption = type === "option" || (typeof type === "string" && type.toLowerCase() === "option");
    if (isOption) {
      const props = child.props as {
        value?: string | number;
        children?: React.ReactNode;
        disabled?: boolean;
      };
      const label = textOf(props.children).trim();
      const value = props.value != null ? String(props.value) : label;
      if (!label && value === "") return;
      options.push({
        value,
        label: label || value,
        disabled: Boolean(props.disabled),
      });
      return;
    }
    if (type === React.Fragment) {
      options.push(...parseOptionChildren((child.props as { children?: React.ReactNode }).children));
    }
  });
  return options;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value: valueProp,
      defaultValue,
      onChange,
      onValueChange,
      children,
      options: optionsProp,
      className,
      menuClassName,
      wrapperClassName,
      id,
      name,
      disabled,
      placeholder,
      icon,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
    },
    ref,
  ) => {
    const parsed = React.useMemo(
      () => (optionsProp && optionsProp.length > 0 ? optionsProp : parseOptionChildren(children)),
      [optionsProp, children],
    );
    const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
    const isControlled = valueProp !== undefined;
    const value = isControlled ? valueProp : uncontrolled;
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [highlight, setHighlight] = React.useState(0);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const searchRef = React.useRef<HTMLInputElement>(null);
    const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const listId = React.useId();
    const { layout, mounted } = useAnchoredOverlay(open, triggerRef, { minWidth: 196, maxMenuHeight: 340 });

    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const selected = parsed.find((opt) => opt.value === value);
    const searchable = parsed.length > 8;
    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return parsed;
      return parsed.filter((opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q));
    }, [parsed, query]);

    React.useEffect(() => {
      if (!open) return;
      const idx = Math.max(
        0,
        parsed.findIndex((opt) => opt.value === value && !opt.disabled),
      );
      setHighlight(idx === -1 ? 0 : idx);
      const t = window.setTimeout(() => {
        if (searchable) searchRef.current?.focus();
        else optionRefs.current[idx]?.focus();
      }, 20);
      return () => window.clearTimeout(t);
      // Focus the menu only when it opens, not on each filter keystroke.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    React.useEffect(() => {
      if (!open) setQuery("");
    }, [open]);

    React.useEffect(() => {
      if (!open || layout?.mode !== "sheet") return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }, [open, layout?.mode]);

    React.useEffect(() => {
      optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
    }, [highlight]);

    const commit = React.useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolled(next);
        onChange?.({ target: { value: next, name } });
        onValueChange?.(next);
        setOpen(false);
        triggerRef.current?.focus();
      },
      [isControlled, name, onChange, onValueChange],
    );

    const moveHighlight = React.useCallback(
      (dir: 1 | -1) => {
        if (filtered.length === 0) return;
        let next = highlight;
        for (let i = 0; i < filtered.length; i += 1) {
          next = (next + dir + filtered.length) % filtered.length;
          if (!filtered[next]?.disabled) {
            setHighlight(next);
            return;
          }
        }
      },
      [filtered, highlight],
    );

    function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
    }

    function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveHighlight(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveHighlight(-1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setHighlight(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setHighlight(Math.max(0, filtered.length - 1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const opt = filtered[highlight];
        if (opt && !opt.disabled) commit(opt.value);
      }
    }

    const display = selected?.label || placeholder || "Select";
    const isPlaceholder = !selected || (selected.value === "" && Boolean(placeholder));

    const menu =
      open && mounted && layout
        ? createPortal(
            <div className="ui-select-layer" data-mode={layout.mode}>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close options"
                className={cn("ui-select-veil", layout.mode === "popover" && "max-sm:block sm:bg-transparent")}
                onClick={() => setOpen(false)}
              />
              <div
                role="listbox"
                id={listId}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-activedescendant={filtered[highlight] ? `${listId}-opt-${highlight}` : undefined}
                onKeyDown={onMenuKeyDown}
                style={
                  layout.mode === "popover"
                    ? {
                        top: layout.top,
                        bottom: layout.bottom,
                        left: layout.left,
                        width: layout.width,
                        maxHeight: layout.maxHeight,
                      }
                    : undefined
                }
                className={cn(
                  "ui-select-menu",
                  layout.mode === "sheet" ? "ui-select-sheet" : "ui-select-popover",
                  menuClassName,
                )}
              >
                {layout.mode === "sheet" && (
                  <div className="mb-2 flex flex-col items-center pt-1">
                    <span className="ui-select-handle" />
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {ariaLabel || placeholder || "Choose an option"}
                    </p>
                  </div>
                )}
                {searchable && (
                  <div className="relative mb-1.5">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setHighlight(0);
                      }}
                      placeholder="Search…"
                      autoComplete="off"
                      className="ui-select-search"
                      aria-label="Search options"
                    />
                  </div>
                )}
                <div className="ui-select-list">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No matches</p>
                  ) : (
                    filtered.map((opt, idx) => {
                      const active = opt.value === value;
                      const focused = idx === highlight;
                      return (
                        <button
                          key={`${opt.value}-${idx}`}
                          ref={(el) => {
                            optionRefs.current[idx] = el;
                          }}
                          type="button"
                          role="option"
                          id={`${listId}-opt-${idx}`}
                          aria-selected={active}
                          disabled={opt.disabled}
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => {
                            if (!opt.disabled) commit(opt.value);
                          }}
                          className={cn(
                            "ui-select-option",
                            active && "ui-select-option-active",
                            focused && "ui-select-option-focus",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null;

    return (
      <div className={cn("relative min-w-0 w-full", wrapperClassName)}>
        {name ? <input type="hidden" name={name} value={value} /> : null}
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "ui-select-trigger",
            icon && "pl-9",
            open && "ui-select-trigger-open",
            isPlaceholder && "text-muted-foreground",
            className,
          )}
        >
          {icon ? <span className="ui-select-icon">{icon}</span> : null}
          <span className="min-w-0 flex-1 truncate text-left">{display}</span>
          <ChevronDown
            className={cn("ui-select-chevron", open && "rotate-180")}
            strokeWidth={1.85}
          />
        </button>
        {menu}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
