import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { fetchResources, fetchFilterOptions } from "../api/client";
import type { Resource, FilterOptions } from "../types";
import FilterInput from "./FilterInput";
import type { FilterInputHandle } from "./FilterInput";
import DatePicker from "./DatePicker";

type SortKey = "name" | "cluster" | "namespace" | "kind" | "firstSeen" | "lastSeen";
type SortDir = "asc" | "desc" | null;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "cluster", label: "Cluster" },
  { key: "namespace", label: "Namespace" },
  { key: "kind", label: "Kind" },
  { key: "firstSeen", label: "First Seen" },
  { key: "lastSeen", label: "Last Seen" },
];

function getCellValue(r: Resource, col: SortKey): string {
  if (col === "firstSeen" || col === "lastSeen") {
    return new Date(r[col]).toLocaleDateString();
  }
  return r[col];
}

interface Props {
  onSelect: (id: number) => void;
}

export default function ResourceTable({ onSelect }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [options, setOptions] = useState<FilterOptions>({
    clusters: [],
    namespaces: [],
    kinds: [],
    names: [],
  });

  const [asOf, setAsOf] = useState("");
  const [filters, setFilters] = useState({
    cluster: "",
    namespace: "",
    kind: "",
    name: "",
  });
  const [sortKey, setSortKey] = useState<SortKey | null>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [copied, setCopied] = useState(false);

  // Cell selection state (rectangular)
  const [selection, setSelection] = useState<{
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  } | null>(null);
  const dragging = useRef(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const refs = {
    cluster: useRef<FilterInputHandle>(null),
    namespace: useRef<FilterInputHandle>(null),
    kind: useRef<FilterInputHandle>(null),
    name: useRef<FilterInputHandle>(null),
  };

  useEffect(() => {
    fetchFilterOptions().then(setOptions);
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.cluster) params.cluster = filters.cluster;
    if (filters.namespace) params.namespace = filters.namespace;
    if (filters.kind) params.kind = filters.kind;
    if (filters.name) params.name = filters.name;
    if (asOf) params.asOf = asOf;
    fetchResources(params).then(setResources);
  }, [filters, asOf]);

  function cycleSort(key: SortKey) {
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

  const sortedResources = useMemo(() => {
    if (!sortKey || !sortDir) return resources;
    return [...resources].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [resources, sortKey, sortDir]);

  // Cell selection handlers
  const handleCellMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      // Don't start selection on links/buttons/copy icons
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("a")) return;

      e.preventDefault();
      dragging.current = true;
      setSelection({ startRow: row, endRow: row, startCol: col, endCol: col });
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

  // Clear selection on click outside table
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelection(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cmd/Ctrl+C to copy selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selection) return;
      if (e.key === "Escape") {
        setSelection(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);
        const lines = sortedResources
          .slice(minRow, maxRow + 1)
          .map((r) =>
            COLUMNS.slice(minCol, maxCol + 1)
              .map((c) => getCellValue(r, c.key))
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
  }, [selection, sortedResources]);

  function isCellSelected(row: number, col: number): boolean {
    if (!selection) return false;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  }

  const selectionCount = selection
    ? (Math.abs(selection.endRow - selection.startRow) + 1) *
      (Math.abs(selection.endCol - selection.startCol) + 1)
    : 0;

  const hasFilters = filters.cluster || filters.namespace || filters.kind || filters.name;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <DatePicker value={asOf} onChange={setAsOf} />
        {hasFilters && (
          <button
            className="text-xs text-gray-500 hover:text-red-500 ml-auto"
            onClick={() =>
              setFilters({ cluster: "", namespace: "", kind: "", name: "" })
            }
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm text-left select-none">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <ThFilter label="Name" value={filters.name} sortDir={sortKey === "name" ? sortDir : null} onSort={() => cycleSort("name")} onFilter={() => refs.name.current?.toggle()}>
                <FilterInput ref={refs.name} label="name" value={filters.name} options={options.names} onChange={(v) => setFilters((f) => ({ ...f, name: v }))} compact />
              </ThFilter>
              <ThFilter label="Cluster" value={filters.cluster} sortDir={sortKey === "cluster" ? sortDir : null} onSort={() => cycleSort("cluster")} onFilter={() => refs.cluster.current?.toggle()}>
                <FilterInput ref={refs.cluster} label="cluster" value={filters.cluster} options={options.clusters} onChange={(v) => setFilters((f) => ({ ...f, cluster: v }))} compact />
              </ThFilter>
              <ThFilter label="Namespace" value={filters.namespace} sortDir={sortKey === "namespace" ? sortDir : null} onSort={() => cycleSort("namespace")} onFilter={() => refs.namespace.current?.toggle()}>
                <FilterInput ref={refs.namespace} label="namespace" value={filters.namespace} options={options.namespaces} onChange={(v) => setFilters((f) => ({ ...f, namespace: v }))} compact />
              </ThFilter>
              <ThFilter label="Kind" value={filters.kind} sortDir={sortKey === "kind" ? sortDir : null} onSort={() => cycleSort("kind")} onFilter={() => refs.kind.current?.toggle()}>
                <FilterInput ref={refs.kind} label="kind" value={filters.kind} options={options.kinds} onChange={(v) => setFilters((f) => ({ ...f, kind: v }))} compact />
              </ThFilter>
              <ThSortable label="First Seen" sortDir={sortKey === "firstSeen" ? sortDir : null} onSort={() => cycleSort("firstSeen")} />
              <ThSortable label="Last Seen" sortDir={sortKey === "lastSeen" ? sortDir : null} onSort={() => cycleSort("lastSeen")} />
            </tr>
          </thead>
          <tbody>
            {sortedResources.map((r, rowIdx) => (
              <tr
                key={r.id}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                <td
                  className={`px-4 py-2 font-mono group/cell cursor-cell cell-selectable ${isCellSelected(rowIdx, 0) ? "cell-selected" : ""}`}
                  onMouseDown={(e) => handleCellMouseDown(rowIdx, 0, e)}
                  onMouseEnter={() => handleCellMouseEnter(rowIdx, 0)}
                >
                  <span className="relative z-[1] flex items-center gap-1.5">
                    <button
                      className="text-blue-500 hover:text-blue-400 hover:underline text-left"
                      onClick={() => onSelect(r.id)}
                    >
                      {r.name}
                    </button>
                    <CopyButton text={r.name} />
                  </span>
                </td>
                <td
                  className={`px-4 py-2 group/cell cursor-cell cell-selectable ${isCellSelected(rowIdx, 1) ? "cell-selected" : ""}`}
                  onMouseDown={(e) => handleCellMouseDown(rowIdx, 1, e)}
                  onMouseEnter={() => handleCellMouseEnter(rowIdx, 1)}
                >
                  <span className="relative z-[1] flex items-center gap-1.5">
                    {r.cluster}
                    <CopyButton text={r.cluster} />
                  </span>
                </td>
                <td
                  className={`px-4 py-2 group/cell cursor-cell cell-selectable ${isCellSelected(rowIdx, 2) ? "cell-selected" : ""}`}
                  onMouseDown={(e) => handleCellMouseDown(rowIdx, 2, e)}
                  onMouseEnter={() => handleCellMouseEnter(rowIdx, 2)}
                >
                  <span className="relative z-[1] flex items-center gap-1.5">
                    {r.namespace}
                    <CopyButton text={r.namespace} />
                  </span>
                </td>
                <td
                  className={`px-4 py-2 group/cell cursor-cell cell-selectable ${isCellSelected(rowIdx, 3) ? "cell-selected" : ""}`}
                  onMouseDown={(e) => handleCellMouseDown(rowIdx, 3, e)}
                  onMouseEnter={() => handleCellMouseEnter(rowIdx, 3)}
                >
                  <span className="relative z-[1] flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
                      {r.kind}
                    </span>
                    <CopyButton text={r.kind} />
                  </span>
                </td>
                <td
                  className={`px-4 py-2 text-gray-500 group/cell cursor-cell cell-selectable ${isCellSelected(rowIdx, 4) ? "cell-selected" : ""}`}
                  onMouseDown={(e) => handleCellMouseDown(rowIdx, 4, e)}
                  onMouseEnter={() => handleCellMouseEnter(rowIdx, 4)}
                >
                  <span className="relative z-[1] flex items-center gap-1.5">
                    {new Date(r.firstSeen).toLocaleDateString()}
                    <CopyButton text={new Date(r.firstSeen).toLocaleDateString()} />
                  </span>
                </td>
                <td
                  className={`px-4 py-2 text-gray-500 group/cell cursor-cell cell-selectable ${isCellSelected(rowIdx, 5) ? "cell-selected" : ""}`}
                  onMouseDown={(e) => handleCellMouseDown(rowIdx, 5, e)}
                  onMouseEnter={() => handleCellMouseEnter(rowIdx, 5)}
                >
                  <span className="relative z-[1] flex items-center gap-1.5">
                    {new Date(r.lastSeen).toLocaleDateString()}
                    <CopyButton text={new Date(r.lastSeen).toLocaleDateString()} />
                  </span>
                </td>
              </tr>
            ))}
            {resources.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No resources found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <span>{resources.length} resources shown</span>
        {selection && selectionCount > 0 && (
          <span className="text-blue-500">
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {" "}Copied!
              </>
            ) : (
              <>{selectionCount} cell{selectionCount > 1 ? "s" : ""} selected — Cmd+C to copy</>
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
      <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  if (dir === "desc") {
    return (
      <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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
        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
