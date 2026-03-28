import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchResources, fetchFilterOptions } from "../api/client";
import type { Resource, FilterOptions } from "../types";
import DataTable from "./DataTable";
import type { ColumnDef } from "./DataTable";
import DatePicker from "./DatePicker";
import { filtersToParams, paramsToFilters } from "../hooks/useRoute";

interface Props {
  params: Record<string, string>;
  onSelect: (id: number) => void;
}

export default function ResourceTable({ params, onSelect }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [options, setOptions] = useState<FilterOptions>({
    clusters: [],
    namespaces: [],
    kinds: [],
    names: [],
  });

  const asOf = params.asOf || "";
  const initialFilters = useMemo(() => paramsToFilters(params), [params]);

  const setAsOf = useCallback((v: string) => {
    const current = new URLSearchParams(window.location.hash.split("?")[1] || "");
    if (v) current.set("asOf", v); else current.delete("asOf");
    const search = current.toString();
    window.location.hash = "#/resources" + (search ? "?" + search : "");
  }, []);

  const onFiltersChange = useCallback((filters: Record<string, string[]>) => {
    const current = new URLSearchParams(window.location.hash.split("?")[1] || "");
    // Remove old filter params
    [...current.keys()].filter(k => k.startsWith("f.")).forEach(k => current.delete(k));
    // Add new ones
    for (const [k, v] of Object.entries(filtersToParams(filters))) {
      current.set(k, v);
    }
    const search = current.toString();
    window.location.hash = "#/resources" + (search ? "?" + search : "");
  }, []);

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
      />
    </div>
  );
}
