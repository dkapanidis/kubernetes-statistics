import { useEffect, useState, useMemo, useCallback } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { fetchResources, fetchFilterOptions } from "../api/client";
import type { Resource, FilterOptions } from "../types";
import DataTable from "./DataTable";
import type { ColumnDef } from "./DataTable";
import DatePicker from "./DatePicker";
import { paramsToFilters, paramsToSort, writeFilters, writeSort } from "../hooks/useTableParams";

interface Props {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  onSelect: (id: number) => void;
}

export default function ResourceTable({ searchParams, setSearchParams, onSelect }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [options, setOptions] = useState<FilterOptions>({
    clusters: [],
    namespaces: [],
    kinds: [],
    names: [],
  });

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

  const onFiltersChange = useCallback(
    (filters: Record<string, string[]>) => writeFilters(setSearchParams, filters),
    [setSearchParams],
  );

  const onSortChange = useCallback(
    (key: string | null, dir: "asc" | "desc" | null) => writeSort(setSearchParams, key, dir),
    [setSearchParams],
  );

  useEffect(() => {
    fetchFilterOptions().then(setOptions);
  }, []);

  useEffect(() => {
    fetchResources(asOf ? { asOf } : undefined).then(setResources);
  }, [asOf]);

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
        className: "text-gray-500",
      },
      {
        key: "lastSeen",
        label: "Last Seen",
        getValue: (r) => new Date(r.lastSeen).toLocaleDateString(),
        className: "text-gray-500",
      },
    ],
    [options, onSelect],
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <DataTable
        columns={columns}
        data={resources}
        rowKey={(r) => r.id}
        emptyMessage="No resources found"
        toolbar={<DatePicker value={asOf} onChange={setAsOf} />}
        initialFilters={initialFilters}
        onFiltersChange={onFiltersChange}
        initialSort={initialSort}
        onSortChange={onSortChange}
      />
    </div>
  );
}
