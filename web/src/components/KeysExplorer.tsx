import { useEffect, useState } from "react";
import { fetchKeyValues, fetchFilterOptions, fetchKeys } from "../api/client";
import type { KeyValueEntry, FilterOptions } from "../types";
import FilterInput from "./FilterInput";

const OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "like", label: "~" },
];

interface Props {
  onSelectResource: (id: number) => void;
}

export default function KeysExplorer({ onSelectResource }: Props) {
  const [options, setOptions] = useState<FilterOptions>({
    clusters: [],
    namespaces: [],
    kinds: [],
  });
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [entries, setEntries] = useState<KeyValueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    key: "",
    value: "",
    op: "eq",
    kind: "",
    cluster: "",
    namespace: "",
    name: "",
  });

  useEffect(() => {
    fetchFilterOptions().then(setOptions);
    fetchKeys().then(setAllKeys);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filters.key) params.key = filters.key;
    if (filters.value) {
      params.value = filters.value;
      params.op = filters.op;
    }
    if (filters.kind) params.kind = filters.kind;
    if (filters.cluster) params.cluster = filters.cluster;
    if (filters.namespace) params.namespace = filters.namespace;
    if (filters.name) params.name = filters.name;
    fetchKeyValues(params)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [filters]);

  const hasFilters = Object.values(filters).some(
    (v) => v !== "" && v !== "eq",
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Key</label>
            <FilterInput
              label="key"
              value={filters.key}
              options={allKeys}
              onChange={(v) => setFilters((f) => ({ ...f, key: v }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Op</label>
            <select
              className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
              value={filters.op}
              onChange={(e) =>
                setFilters((f) => ({ ...f, op: e.target.value }))
              }
            >
              {OPS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Value</label>
            <input
              className="border rounded px-3 py-1.5 text-sm font-mono bg-white dark:bg-gray-700 dark:border-gray-600 w-36"
              placeholder="e.g. 14"
              value={filters.value}
              onChange={(e) =>
                setFilters((f) => ({ ...f, value: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap items-end">
          <FilterInput
            label="kind"
            value={filters.kind}
            options={options.kinds}
            onChange={(v) => setFilters((f) => ({ ...f, kind: v }))}
          />
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
          <input
            className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 w-44"
            placeholder="Search name..."
            value={filters.name}
            onChange={(e) =>
              setFilters((f) => ({ ...f, name: e.target.value }))
            }
          />
          {hasFilters && (
            <button
              className="text-xs text-gray-500 hover:text-red-500"
              onClick={() =>
                setFilters({
                  key: "",
                  value: "",
                  op: "eq",
                  kind: "",
                  cluster: "",
                  namespace: "",
                  name: "",
                })
              }
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Cluster</th>
              <th className="px-4 py-3">Namespace</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">First Seen</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={`${e.resourceId}-${e.key}-${i}`}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onSelectResource(e.resourceId)}
              >
                <td className="px-4 py-2 text-xs">{e.cluster}</td>
                <td className="px-4 py-2 text-xs">{e.namespace}</td>
                <td className="px-4 py-2">
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
                    {e.kind}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{e.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {e.key}
                </td>
                <td className="px-4 py-2 font-mono text-xs font-semibold">
                  {e.value}
                  {e.valueInt !== undefined && (
                    <span className="ml-1 text-green-600 font-normal">(int)</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {new Date(e.firstSeen).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {hasFilters
                    ? "No matching key-values found"
                    : "Enter a key to start exploring"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <span>
          {entries.length} entries shown
          {loading && " (loading...)"}
        </span>
        <span>Click a row to view resource details</span>
      </div>
    </div>
  );
}
