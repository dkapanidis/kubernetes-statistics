import { useEffect, useState } from "react";
import { fetchResources, fetchFilterOptions } from "../api/client";
import type { Resource, FilterOptions } from "../types";
import FilterInput from "./FilterInput";
import DatePicker from "./DatePicker";

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-3 flex-wrap items-center">
        <FilterInput
          label="cluster"
          value={filters.cluster}
          options={options.clusters}
          onChange={(v) => setFilters((f) => ({ ...f, cluster: v }))}
        />
        <FilterInput
          label="namespace"
          value={filters.namespace}
          options={options.namespaces}
          onChange={(v) => setFilters((f) => ({ ...f, namespace: v }))}
        />
        <FilterInput
          label="kind"
          value={filters.kind}
          options={options.kinds}
          onChange={(v) => setFilters((f) => ({ ...f, kind: v }))}
        />
        <FilterInput
          label="name"
          value={filters.name}
          options={options.names}
          onChange={(v) => setFilters((f) => ({ ...f, name: v }))}
        />
        <DatePicker value={asOf} onChange={setAsOf} />
        {(filters.cluster || filters.namespace || filters.kind || filters.name) && (
          <button
            className="text-xs text-gray-500 hover:text-red-500 ml-auto"
            onClick={() =>
              setFilters({ cluster: "", namespace: "", kind: "", name: "" })
            }
          >
            Clear all
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Cluster</th>
              <th className="px-4 py-3">Namespace</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">First Seen</th>
              <th className="px-4 py-3">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr
                key={r.id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onSelect(r.id)}
              >
                <td className="px-4 py-2">{r.cluster}</td>
                <td className="px-4 py-2">{r.namespace}</td>
                <td className="px-4 py-2">
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
                    {r.kind}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono">{r.name}</td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(r.firstSeen).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(r.lastSeen).toLocaleDateString()}
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
      <div className="p-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
        {resources.length} resources shown
      </div>
    </div>
  );
}
