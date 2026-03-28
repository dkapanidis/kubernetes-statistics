import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchResource } from "../api/client";
import type { ResourceDetail as ResourceDetailType, ResourceValue } from "../types";
import DataTable from "./DataTable";
import type { ColumnDef } from "./DataTable";
import DateCell from "./DateCell";

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

  const columns: ColumnDef<ResourceValue>[] = useMemo(
    () => [
      {
        key: "key",
        label: "Key",
        getValue: (v) => v.key,
        className: "font-mono text-xs",
        defaultSort: "asc" as const,
      },
      {
        key: "value",
        label: "Value",
        getValue: (v) => v.value,
        className: "font-mono text-xs",
      },
      {
        key: "type",
        label: "Type",
        getValue: (v) =>
          v.valueInt !== undefined
            ? "int"
            : v.valueFloat !== undefined
              ? "float"
              : "string",
        render: (v) => (
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
        ),
      },
      {
        key: "firstSeen",
        label: "First Seen",
        getValue: (v) => new Date(v.firstSeen).toLocaleDateString(),
        render: (v) => <DateCell value={v.firstSeen} />,
        className: "text-gray-500 text-xs",
      },
      {
        key: "lastSeen",
        label: "Last Seen",
        getValue: (v) => new Date(v.lastSeen).toLocaleDateString(),
        render: (v) => <DateCell value={v.lastSeen} />,
        className: "text-gray-500 text-xs",
      },
    ],
    [],
  );

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
            First seen: <DateCell value={resource.firstSeen} /> | Last
            seen: <DateCell value={resource.lastSeen} />
          </p>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={resource.values}
        rowKey={(v) => v.key}
        emptyMessage="No values"
      />
    </div>
  );
}
