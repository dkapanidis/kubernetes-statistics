import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SetURLSearchParams } from "react-router-dom";
import { fetchResources, fetchFilterOptions, fetchKeys } from "../api/client";
import { EMPTY_FILTER_OPTIONS, type Resource } from "../types";
import DataTable from "./DataTable";
import type { ColumnDef } from "./DataTable";
import DateCell from "./DateCell";
import DatePicker from "./DatePicker";
import FilterInput from "./FilterInput";
import { paramsToFilters, paramsToSort, writeFilters, writeSort } from "../hooks/useTableParams";

const FILTER_OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "like", label: "~" },
];

interface Props {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  onSelect: (id: number) => void;
}

export default function ResourceTable({ searchParams, setSearchParams, onSelect }: Props) {
  const asOf = searchParams.get("asOf") || "";
  const initialFilters = useMemo(() => paramsToFilters(searchParams), [searchParams]);
  const initialSort = useMemo(() => paramsToSort(searchParams), [searchParams]);

  const setAsOf = useCallback((v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v) next.set("asOf", v); else next.delete("asOf");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(initialFilters || {});
  const [limit, setLimit] = useState(100);

  // Key-value filter state — synced to URL
  const [filterKey, setFilterKeyRaw] = useState(searchParams.get("filterKey") || "");
  const [filterOp, setFilterOpRaw] = useState(searchParams.get("filterOp") || "eq");
  const [filterValue, setFilterValueRaw] = useState(searchParams.get("filterValue") || "");

  const syncKvParam = useCallback((key: string, value: string, defaultValue = "") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== defaultValue) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setFilterKey = useCallback((v: string) => { setFilterKeyRaw(v); syncKvParam("filterKey", v); }, [syncKvParam]);
  const setFilterOp = useCallback((v: string) => { setFilterOpRaw(v); syncKvParam("filterOp", v, "eq"); }, [syncKvParam]);
  const setFilterValue = useCallback((v: string) => { setFilterValueRaw(v); syncKvParam("filterValue", v); }, [syncKvParam]);
  const [kvFilterOpen, setKvFilterOpen] = useState(false);
  const kvWrapperRef = useRef<HTMLDivElement>(null);

  const LABEL_PREFIX = "metadata.labels.";

  // Debounced label search for the filter combobox
  const [labelSearch, setLabelSearch] = useState("");
  const [debouncedLabelSearch, setDebouncedLabelSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLabelSearch(labelSearch), 250);
    return () => clearTimeout(timer);
  }, [labelSearch]);

  const selectedKind = activeFilters.kind?.length === 1 ? activeFilters.kind[0] : undefined;
  const { data: rawLabelKeys = [] } = useQuery({
    queryKey: ["labelKeys", selectedKind, debouncedLabelSearch],
    queryFn: () => fetchKeys(selectedKind, debouncedLabelSearch ? `metadata.labels.%${debouncedLabelSearch}` : "metadata.labels.", 100),
  });
  const labelOptions = rawLabelKeys
    .filter((k) => k.startsWith(LABEL_PREFIX))
    .map((k) => k.slice(LABEL_PREFIX.length));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (kvWrapperRef.current && !kvWrapperRef.current.contains(e.target as Node)) {
        setKvFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const onFiltersChange = useCallback(
    (filters: Record<string, string[]>) => {
      setActiveFilters(filters);
      writeFilters(setSearchParams, filters);
    },
    [setSearchParams],
  );

  const onSortChange = useCallback(
    (key: string | null, dir: "asc" | "desc" | null) => writeSort(setSearchParams, key, dir),
    [setSearchParams],
  );

  const { data: options = EMPTY_FILTER_OPTIONS } =
    useQuery({ queryKey: ["filterOptions"], queryFn: fetchFilterOptions });

  const apiParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (asOf) params.asOf = asOf;
    for (const [key, values] of Object.entries(activeFilters)) {
      if (values.length > 0) {
        params[key] = values.join(",");
      }
    }
    if (filterKey && filterValue) {
      params.filterKey = LABEL_PREFIX + filterKey;
      params.filterOp = filterOp;
      params.filterValue = filterValue;
    }
    params.limit = String(limit);
    return params;
  }, [asOf, activeFilters, filterKey, filterOp, filterValue, limit]);

  const { data: resources = [] } = useQuery({
    queryKey: ["resources", apiParams],
    queryFn: () => fetchResources(apiParams),
  });

  const columns: ColumnDef<Resource>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Name",
        getValue: (r) => r.name,
        render: (r) => (
          <button
            className="text-blue-500 hover:text-blue-400 hover:underline text-left font-mono"
            onClick={() => onSelect(r.id)}
          >
            {r.name}
          </button>
        ),
        filterOptions: options.names,
        defaultSort: "asc" as const,
      },
      {
        key: "cluster",
        label: "Cluster",
        getValue: (r) => r.cluster,
        filterOptions: options.clusters,
      },
      {
        key: "namespace",
        label: "Namespace",
        getValue: (r) => r.namespace,
        filterOptions: options.namespaces,
      },
      {
        key: "source",
        label: "Source",
        getValue: (r) => r.source,
        filterOptions: options.sources,
      },
      {
        key: "kind",
        label: "Kind",
        getValue: (r) => r.kind,
        render: (r) => (
          <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
            {r.kind}
          </span>
        ),
        filterOptions: options.kinds,
      },
      {
        key: "firstSeen",
        label: "First Seen",
        getValue: (r) => new Date(r.firstSeen).toLocaleDateString(),
        render: (r) => <DateCell value={r.firstSeen} />,
        className: "text-gray-500",
      },
      {
        key: "lastSeen",
        label: "Last Seen",
        getValue: (r) => new Date(r.lastSeen).toLocaleDateString(),
        render: (r) => <DateCell value={r.lastSeen} />,
        className: "text-gray-500",
      },
    ],
    [options, onSelect],
  );

  const hasKvFilter = filterKey !== "" && filterValue !== "";

  const toolbar = (
    <>
      <DatePicker value={asOf} onChange={setAsOf} />
      <div ref={kvWrapperRef} className="relative">
        <button
          className="text-xs text-gray-500 hover:text-blue-500 flex items-center gap-1"
          onClick={() => setKvFilterOpen((o) => !o)}
        >
          Filter by label
          {hasKvFilter && (
            <span className="text-blue-500">
              ({filterKey} {FILTER_OPS.find((o) => o.value === filterOp)?.label} {filterValue})
            </span>
          )}
        </button>
        {kvFilterOpen && (
          <div className="absolute z-20 mt-1 left-0 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg p-2">
            <div className="flex gap-1 items-center">
              <div className="w-44">
                <FilterInput
                  label="label"
                  value={filterKey}
                  options={labelOptions}
                  onChange={setFilterKey}
                  onSearch={setLabelSearch}
                />
              </div>
              <select
                className="border rounded px-1 py-1.5 text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
                value={filterOp}
                onChange={(e) => setFilterOp(e.target.value)}
              >
                {FILTER_OPS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <input
                className="w-36 border rounded px-2 py-1.5 text-xs font-mono bg-white dark:bg-gray-700 dark:border-gray-600 placeholder:text-gray-400"
                placeholder="value"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" || e.key === "Enter") setKvFilterOpen(false);
                }}
              />
              {hasKvFilter && (
                <button
                  className="text-xs text-gray-400 hover:text-red-500 px-1"
                  onClick={() => {
                    setFilterKey("");
                    setFilterOp("eq");
                    setFilterValue("");
                    setKvFilterOpen(false);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <DataTable
        columns={columns}
        data={resources}
        rowKey={(r) => r.id}
        emptyMessage="No resources found"
        toolbar={toolbar}
        initialFilters={initialFilters}
        onFiltersChange={onFiltersChange}
        initialSort={initialSort}
        onSortChange={onSortChange}
        footer={
          <span className="flex items-center gap-1.5 ml-auto">
            Show
            <select
              className="border rounded px-1.5 py-0.5 text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[50, 100, 250, 500, 1000].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            rows
          </span>
        }
      />
    </div>
  );
}
