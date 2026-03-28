import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";

interface Props {
  label: string;
  selected: string[];
  options: string[];
  onChange: (selected: string[]) => void;
  compact?: boolean;
}

export interface FilterInputHandle {
  toggle: () => void;
  anchorRef?: React.RefObject<HTMLSpanElement | null>;
}

const FilterInput = forwardRef<FilterInputHandle, Props>(
  function FilterInput({ label, selected, options, onChange, compact }, forwardedRef) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlighted, setHighlighted] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null);

    useImperativeHandle(forwardedRef, () => ({
      toggle() {
        setOpen((o) => {
          if (!o) {
            setSearch("");
            setTimeout(() => inputRef.current?.focus(), 0);
          }
          return !o;
        });
      },
      anchorRef,
    }));

    // Update portal position when open in compact mode
    useEffect(() => {
      if (!open || !compact || !anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPortalPos({ top: rect.bottom + 4, left: rect.left });
    }, [open, compact]);

    const filtered = options
      .filter((o) => fuzzyMatch(o, search))
      .sort((a, b) => fuzzyScore(a, search) - fuzzyScore(b, search));

    useEffect(() => {
      setHighlighted(-1);
    }, [search]);

    useEffect(() => {
      function handleClick(e: MouseEvent) {
        const target = e.target as Node;
        if (
          wrapperRef.current && !wrapperRef.current.contains(target) &&
          (!anchorRef.current || !anchorRef.current.contains(target))
        ) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function toggleOption(option: string) {
      if (selected.includes(option)) {
        onChange(selected.filter((s) => s !== option));
      } else {
        onChange([...selected, option]);
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (!open || filtered.length === 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlighted((h) => Math.max(h - 1, -1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlighted >= 0 && highlighted < filtered.length) {
            toggleOption(filtered[highlighted]);
          }
          break;
        case "Escape":
          setOpen(false);
          setHighlighted(-1);
          break;
      }
    }

    useEffect(() => {
      if (highlighted >= 0 && listRef.current) {
        const items = listRef.current.querySelectorAll("[data-option]");
        items[highlighted]?.scrollIntoView({ block: "nearest" });
      }
    }, [highlighted]);

    const dropdownContent = (
      <>
        <div className="relative border-b dark:border-gray-600">
          <input
            ref={inputRef}
            className="filter-dropdown-input w-full px-2 py-1.5 pr-6 text-xs bg-transparent placeholder:text-gray-400 text-gray-800 dark:text-gray-200"
            placeholder={`Search ${label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {search && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => {
                setSearch("");
                inputRef.current?.focus();
              }}
              tabIndex={-1}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {filtered.length > 0 && (
          <ul
            ref={listRef}
            className="max-h-48 overflow-y-auto text-sm"
          >
            {filtered.map((o, i) => {
              const isSelected = selected.includes(o);
              return (
                <li
                  key={o}
                  data-option
                  className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${
                    i === highlighted
                      ? "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                      : isSelected
                        ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                        : "hover:bg-gray-100 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => toggleOption(o)}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <span className={`w-3.5 h-3.5 border rounded flex-shrink-0 flex items-center justify-center ${
                    isSelected
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "border-gray-300 dark:border-gray-500"
                  }`}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span>{highlightMatch(o, search)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );

    if (compact) {
      // Headless mode: anchor span + portal dropdown
      if (!open) return <span ref={anchorRef} />;
      const dropdown = (
        <div
          ref={wrapperRef}
          className="fixed z-50 min-w-[12rem] normal-case text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg overflow-hidden"
          style={portalPos ? { top: portalPos.top, left: portalPos.left } : { visibility: "hidden" }}
        >
          {dropdownContent}
        </div>
      );
      return (
        <>
          <span ref={anchorRef} />
          {createPortal(dropdown, document.body)}
        </>
      );
    }

    // Standard mode: visible input with dropdown
    return (
      <div ref={wrapperRef} className="relative">
        <div className={`border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 w-44 ${open && filtered.length > 0 ? "rounded-b-none" : ""}`}>
          <div className="relative">
            <input
              ref={inputRef}
              className="filter-dropdown-input w-full px-3 py-1.5 pr-7 text-sm bg-transparent text-gray-800 dark:text-gray-200"
              placeholder={`Filter ${label}...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
            />
            {selected.length > 0 && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => {
                  onChange([]);
                  inputRef.current?.focus();
                }}
                tabIndex={-1}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {open && filtered.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-t-0 dark:border-gray-600 rounded-b-lg shadow-lg max-h-48 overflow-y-auto text-sm min-w-[10rem]"
          >
            {filtered.map((o, i) => {
              const isSelected = selected.includes(o);
              return (
                <li
                  key={o}
                  data-option
                  className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${
                    i === highlighted
                      ? "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                      : isSelected
                        ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                        : "hover:bg-gray-100 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => toggleOption(o)}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <span className={`w-3.5 h-3.5 border rounded flex-shrink-0 flex items-center justify-center ${
                    isSelected
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "border-gray-300 dark:border-gray-500"
                  }`}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span>{highlightMatch(o, search)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  },
);

export default FilterInput;

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    ti = t.indexOf(q[qi], ti);
    if (ti === -1) return false;
    ti++;
  }
  return true;
}

// Lower score = better match. Prefers consecutive and early matches.
function fuzzyScore(text: string, query: string): number {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let score = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return Infinity;
    score += idx - ti; // penalize gaps
    ti = idx + 1;
  }
  return score;
}

function fuzzyHighlightIndices(text: string, query: string): number[] {
  if (!query) return [];
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  const indices: number[] = [];
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return indices;
    indices.push(idx);
    ti = idx + 1;
  }
  return indices;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const indices = new Set(fuzzyHighlightIndices(text, query));
  if (indices.size === 0) return text;
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    if (indices.has(i)) {
      let end = i;
      while (end < text.length && indices.has(end)) end++;
      parts.push(<span key={i} className="font-bold underline">{text.slice(i, end)}</span>);
      i = end;
    } else {
      let end = i;
      while (end < text.length && !indices.has(end)) end++;
      parts.push(text.slice(i, end));
      i = end;
    }
  }
  return <>{parts}</>;
}
