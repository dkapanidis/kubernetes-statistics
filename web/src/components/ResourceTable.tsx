import { useEffect, useState } from "react";
import { fetchResources } from "../api/client";
import type { Resource } from "../types";

interface Props {
  onSelect: (id: number) => void;
}

export default function ResourceTable({ onSelect }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [filters, setFilters] = useState({
    cluster: "",
    namespace: "",
    kind: "",
  });

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.cluster) params.cluster = filters.cluster;
    if (filters.namespace) params.namespace = filters.namespace;
    if (filters.kind) params.kind = filters.kind;
    fetchResources(params).then(setResources);
  }, [filters]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-3 flex-wrap">
        <input
          className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
          placeholder="Filter cluster..."
          value={filters.cluster}
          onChange={(e) =>
            setFilters((f) => ({ ...f, cluster: e.target.value }))
          }
        />
        <input
          className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
          placeholder="Filter namespace..."
          value={filters.namespace}
          onChange={(e) =>
            setFilters((f) => ({ ...f, namespace: e.target.value }))
          }
        />
        <input
          className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
          placeholder="Filter kind..."
          value={filters.kind}
          onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
        />
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
    </div>
  );
}
