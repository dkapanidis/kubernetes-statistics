import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode } from "react";
import FilterInput from "./FilterInput";
import type { FilterInputHandle } from "./FilterInput";

type SortDir = "asc" | "desc" | null;

export interface ColumnDef<T> {
  key: string;
  label: string;
  getValue: (row: T) => string;
  render?: (row: T, rowIdx: number) => ReactNode;
  className?: string;
  filterOptions?: string[];
  defaultSort?: SortDir;
}

interface Props<T> {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (row: T, idx: number) => string | number;
  emptyMessage?: string;
  footer?: ReactNode;
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = "No results",
  footer,
}: Props<T>) {
  // Sorting
  const defaultSortCol = columns.find((c) => c.defaultSort);
  const [sortKey, setSortKey] = useState<string | null>(
    defaultSortCol?.key ?? null,
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    defaultSortCol?.defaultSort ?? null,
  );

  // Filtering
  const [filters, setFilters] = useState<Record<string, string>>({});
  const filterRefs = useRef<Record<string, FilterInputHandle | null>>({});

  // Selection
  const [selection, setSelection] = useState<{
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  } | null>(null);
  const [cursor, setCursor] = useState<{ row: number; col: number } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const fullRowMode = useRef(true);
  const dragging = useRef(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);

  // Sorting
  function cycleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((row) =>
      columns.every((col) => {
        const fv = filters[col.key];
        if (!fv) return true;
        return col
          .getValue(row)
          .toLowerCase()
          .includes(fv.toLowerCase());
      }),
    );
  }, [data, filters, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = col.getValue(a);
      const bv = col.getValue(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir, columns]);

  // Cell selection handlers
  const handleCellMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("a")) return;
      e.preventDefault();
      dragging.current = true;
      fullRowMode.current = false;
      setSelection({ startRow: row, endRow: row, startCol: col, endCol: col });
      setCursor({ row, col });
    },
    [],
  );

  const handleCellMouseEnter = useCallback(
    (row: number, col: number) => {
      if (!dragging.current) return;
      setSelection((s) => (s ? { ...s, endRow: row, endCol: col } : null));
    },
    [],
  );

  useEffect(() => {
    function handleMouseUp() {
      dragging.current = false;
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSelection(null);
        setCursor(null);
        fullRowMode.current = true;
        active.current = false;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const maxRow = sortedData.length - 1;
    const maxCol = columns.length - 1;

    function handleKeyDown(e: KeyboardEvent) {
      if (!active.current) return;

      // Don't capture keys when focus is inside a dialog, modal, or input element
      const target = e.target as HTMLElement;
      if (
        target.closest("dialog") ||
        target.closest("[role='dialog']") ||
        target.closest("[role='alertdialog']") ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const isHorizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
        if (isHorizontal && fullRowMode.current) {
          fullRowMode.current = false;
        }

        const cur = cursor ?? { row: 0, col: 0 };
        const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        const dc = isHorizontal ? (e.key === "ArrowRight" ? 1 : -1) : 0;
        const newRow = Math.max(0, Math.min(maxRow, cur.row + dr));
        const newCol = Math.max(0, Math.min(maxCol, cur.col + dc));

        if (e.shiftKey && selection) {
          if (fullRowMode.current) {
            setSelection((s) =>
              s
                ? { ...s, endRow: newRow, startCol: 0, endCol: maxCol }
                : null,
            );
          } else {
            setSelection((s) =>
              s ? { ...s, endRow: newRow, endCol: newCol } : null,
            );
          }
        } else {
          if (fullRowMode.current) {
            setSelection({
              startRow: newRow,
              endRow: newRow,
              startCol: 0,
              endCol: maxCol,
            });
          } else {
            setSelection({
              startRow: newRow,
              endRow: newRow,
              startCol: newCol,
              endCol: newCol,
            });
          }
        }
        setCursor({ row: newRow, col: newCol });
        return;
      }

      if (!selection) return;

      if (e.key === "Escape") {
        setSelection(null);
        setCursor(null);
        fullRowMode.current = true;
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxR = Math.max(selection.startRow, selection.endRow);
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxC = Math.max(selection.startCol, selection.endCol);
        const lines = sortedData
          .slice(minRow, maxR + 1)
          .map((r) =>
            columns
              .slice(minCol, maxC + 1)
              .map((c) => c.getValue(r))
              .join("\t"),
          );
        navigator.clipboard.writeText(lines.join("\n"));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        e.preventDefault();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selection, cursor, sortedData, columns]);

  function isCellSelected(row: number, col: number): boolean {
    if (!selection) return false;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  }

  const selectionRowCount = selection
    ? Math.abs(selection.endRow - selection.startRow) + 1
    : 0;
  const selectionColCount = selection
    ? Math.abs(selection.endCol - selection.startCol) + 1
    : 0;
  const isFullRowSelection = selection
    ? Math.min(selection.startCol, selection.endCol) === 0 &&
      Math.max(selection.startCol, selection.endCol) === columns.length - 1
    : false;

  const hasFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => { active.current = true; }}
      onMouseLeave={() => { active.current = false; }}
    >
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm text-left select-none">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              {columns.map((col) =>
                col.filterOptions ? (
                  <ThFilter
                    key={col.key}
                    label={col.label}
                    value={filters[col.key] || ""}
                    sortDir={sortKey === col.key ? sortDir : null}
                    onSort={() => cycleSort(col.key)}
                    onFilter={() =>
                      filterRefs.current[col.key]?.toggle()
                    }
                  >
                    <FilterInput
                      ref={(el) => {
                        filterRefs.current[col.key] = el;
                      }}
                      label={col.key}
                      value={filters[col.key] || ""}
                      options={col.filterOptions}
                      onChange={(v) =>
                        setFilters((f) => ({ ...f, [col.key]: v }))
                      }
                      compact
                    />
                  </ThFilter>
                ) : (
                  <ThSortable
                    key={col.key}
                    label={col.label}
                    sortDir={sortKey === col.key ? sortDir : null}
                    onSort={() => cycleSort(col.key)}
                  />
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIdx) => (
              <tr
                key={rowKey(row, rowIdx)}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 group/cell cursor-cell cell-selectable ${col.className || ""} ${isCellSelected(rowIdx, colIdx) ? "cell-selected" : ""}`}
                    onMouseDown={(e) =>
                      handleCellMouseDown(rowIdx, colIdx, e)
                    }
                    onMouseEnter={() =>
                      handleCellMouseEnter(rowIdx, colIdx)
                    }
                  >
                    <span className="relative z-[1] flex items-center gap-1.5 w-full">
                      <span className="flex-1 min-w-0">
                        {col.render
                          ? col.render(row, rowIdx)
                          : col.getValue(row)}
                      </span>
                      <CopyButton text={col.getValue(row)} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <span>
          {sortedData.length} {sortedData.length === 1 ? "row" : "rows"}
          {hasFilters
            ? ` (filtered from ${data.length})`
            : ""}
        </span>
        {footer}
        {selection && selectionRowCount > 0 && (
          <span className="text-blue-500">
            {copied ? (
              <>
                <svg
                  className="w-3.5 h-3.5 text-green-500 inline"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>{" "}
                Copied!
              </>
            ) : isFullRowSelection ? (
              <>
                {selectionRowCount} row
                {selectionRowCount > 1 ? "s" : ""} selected — Cmd+C to
                copy
              </>
            ) : (
              <>
                {selectionRowCount * selectionColCount} cell
                {selectionRowCount * selectionColCount > 1 ? "s" : ""}{" "}
                selected — Cmd+C to copy
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc") {
    return (
      <svg
        className="w-3 h-3 text-blue-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 15l7-7 7 7"
        />
      </svg>
    );
  }
  if (dir === "desc") {
    return (
      <svg
        className="w-3 h-3 text-blue-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  }
  return null;
}

function ThFilter({
  label,
  value,
  sortDir,
  onSort,
  onFilter,
  children,
}: {
  label: string;
  value: string;
  sortDir: SortDir;
  onSort: () => void;
  onFilter: () => void;
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 relative">
      <span className="flex items-center gap-1.5 select-none">
        <span
          className="cursor-pointer hover:text-blue-500 flex items-center gap-1"
          onClick={onSort}
        >
          {label}
          <SortIcon dir={sortDir} />
        </span>
        {value ? (
          <span
            className="text-blue-500 normal-case font-normal text-xs truncate max-w-[6rem] cursor-pointer hover:text-blue-400"
            onClick={onFilter}
          >
            ({value})
          </span>
        ) : (
          <svg
            className="w-3 h-3 text-gray-400 opacity-40 cursor-pointer hover:opacity-100"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            onClick={onFilter}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        )}
      </span>
      {children}
    </th>
  );
}

function ThSortable({
  label,
  sortDir,
  onSort,
}: {
  label: string;
  sortDir: SortDir;
  onSort: () => void;
}) {
  return (
    <th className="px-4 py-3">
      <span
        className="flex items-center gap-1 cursor-pointer hover:text-blue-500 select-none"
        onClick={onSort}
      >
        {label}
        <SortIcon dir={sortDir} />
      </span>
    </th>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      className="opacity-0 group-hover/cell:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity shrink-0"
      onClick={handleCopy}
      tabIndex={-1}
      title="Copy"
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
