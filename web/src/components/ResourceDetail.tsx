import { useEffect, useState, useCallback } from "react";
import { fetchResource } from "../api/client";
import type { ResourceDetail as ResourceDetailType } from "../types";

interface Props {
  resourceId: number;
  onBack: () => void;
}

export default function ResourceDetail({ resourceId, onBack }: Props) {
  const [resource, setResource] = useState<ResourceDetailType | null>(null);

  useEffect(() => {
    fetchResource(resourceId).then(setResource);
  }, [resourceId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    },
    [onBack],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!resource) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Back
        </button>
        <div>
          <h2 className="text-lg font-semibold">
            {resource.cluster}/{resource.namespace}/{resource.kind}/
            {resource.name}
          </h2>
          <p className="text-xs text-gray-500">
            First seen: {new Date(resource.firstSeen).toLocaleString()} | Last
            seen: {new Date(resource.lastSeen).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">First Seen</th>
              <th className="px-4 py-3">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {resource.values.map((v) => (
              <tr
                key={v.key}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                <td className="px-4 py-2 font-mono text-xs">{v.key}</td>
                <td className="px-4 py-2 font-mono text-xs">{v.value}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      v.valueInt !== undefined
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : v.valueFloat !== undefined
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {v.valueInt !== undefined
                      ? "int"
                      : v.valueFloat !== undefined
                        ? "float"
                        : "string"}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {new Date(v.firstSeen).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {new Date(v.lastSeen).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
