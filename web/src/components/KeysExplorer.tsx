import { useEffect, useState, useRef, useMemo } from "react";
import { fetchKeyValues, fetchFilterOptions, fetchKeys } from "../api/client";
import type { KeyValueEntry, FilterOptions } from "../types";
import DataTable from "./DataTable";
import type { ColumnDef } from "./DataTable";
import DatePicker from "./DatePicker";

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
    names: [],
  });
  const [asOf, setAsOf] = useState("");
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [entries, setEntries] = useState<KeyValueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverFilters, setServerFilters] = useState({
    key: "",
    value: "",
    op: "eq",
    kind: "",
    cluster: "",
    namespace: "",
    name: "",
  });
  const [valueFilterOpen, setValueFilterOpen] = useState(false);
  const valueWrapperRef = useRef<HTMLDivElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFilterOptions().then(setOptions);
    fetchKeys().then(setAllKeys);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (serverFilters.key) params.key = serverFilters.key;
    if (serverFilters.value) {
      params.value = serverFilters.value;
      params.op = serverFilters.op;
    }
    if (serverFilters.kind) params.kind = serverFilters.kind;
    if (serverFilters.cluster) params.cluster = serverFilters.cluster;
    if (serverFilters.namespace) params.namespace = serverFilters.namespace;
    if (serverFilters.name) params.name = serverFilters.name;
    if (asOf) params.asOf = asOf;
    fetchKeyValues(params)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [serverFilters, asOf]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        valueWrapperRef.current &&
        !valueWrapperRef.current.contains(e.target as Node)
      ) {
        setValueFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const columns: ColumnDef<KeyValueEntry>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Name",
        getValue: (e) => e.name,
        render: (e) => (
          <button
            className="text-blue-500 hover:text-blue-400 hover:underline text-left font-mono text-xs"
            onClick={() => onSelectResource(e.resourceId)}
          >
            {e.name}
          </button>
        ),
        filterOptions: options.names,
        defaultSort: "asc" as const,
      },
      {
        key: "cluster",
        label: "Cluster",
        getValue: (e) => e.cluster,
        className: "text-xs",
        filterOptions: options.clusters,
      },
      {
        key: "namespace",
        label: "Namespace",
        getValue: (e) => e.namespace,
        className: "text-xs",
        filterOptions: options.namespaces,
      },
      {
        key: "kind",
        label: "Kind",
        getValue: (e) => e.kind,
        render: (e) => (
          <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
            {e.kind}
          </span>
        ),
        filterOptions: options.kinds,
      },
      {
        key: "key",
        label: "Key",
        getValue: (e) => e.key,
        className: "font-mono text-xs text-gray-500",
        filterOptions: allKeys,
      },
      {
        key: "value",
        label: "Value",
        getValue: (e) => e.value,
        render: (e) => (
          <span className="font-mono text-xs font-semibold">
            {e.value}
            {e.valueInt !== undefined && (
              <span className="ml-1 text-green-600 font-normal">(int)</span>
            )}
          </span>
        ),
      },
      {
        key: "firstSeen",
        label: "First Seen",
        getValue: (e) => new Date(e.firstSeen).toLocaleDateString(),
        className: "text-xs text-gray-500",
      },
    ],
    [options, allKeys, onSelectResource],
  );

  const hasServerFilters = Object.values(serverFilters).some(
    (v) => v !== "" && v !== "eq",
  );

  const keysToolbar = (
    <>
      <DatePicker value={asOf} onChange={setAsOf} />
      {/* Value filter (server-side with operator) */}
      <div ref={valueWrapperRef} className="relative">
        <button
          className="text-xs text-gray-500 hover:text-blue-500 flex items-center gap-1"
          onClick={() => {
            setValueFilterOpen((o) => {
              if (!o) setTimeout(() => valueInputRef.current?.focus(), 0);
              return !o;
            });
          }}
        >
          Value
          {serverFilters.value && (
            <span className="text-blue-500">
              ({OPS.find((o) => o.value === serverFilters.op)?.label}{" "}
              {serverFilters.value})
            </span>
          )}
        </button>
        {valueFilterOpen && (
          <div className="absolute z-20 mt-1 left-0 min-w-[14rem] bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg p-2 space-y-2">
            <div className="flex gap-1 items-center">
              <select
                className="border rounded px-1 py-1 text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
                value={serverFilters.op}
                onChange={(e) =>
                  setServerFilters((f) => ({ ...f, op: e.target.value }))
                }
              >
                {OPS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                ref={valueInputRef}
                className="flex-1 border rounded px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 dark:border-gray-600 placeholder:text-gray-400 min-w-0"
                placeholder="e.g. 14"
                value={serverFilters.value}
                onChange={(e) =>
                  setServerFilters((f) => ({ ...f, value: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape" || e.key === "Enter")
                    setValueFilterOpen(false);
                }}
              />
            </div>
            {serverFilters.value && (
              <button
                className="text-xs text-gray-400 hover:text-red-500"
                onClick={() => {
                  setServerFilters((f) => ({ ...f, value: "", op: "eq" }));
                  setValueFilterOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  const clearServerFilters = () =>
    setServerFilters({
      key: "",
      value: "",
      op: "eq",
      kind: "",
      cluster: "",
      namespace: "",
      name: "",
    });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <DataTable
        columns={columns}
        data={entries}
        rowKey={(e, i) => `${e.resourceId}-${e.key}-${i}`}
        emptyMessage={
          hasServerFilters
            ? "No matching key-values found"
            : "Enter a key to start exploring"
        }
        footer={loading ? <span>(loading...)</span> : undefined}
        toolbar={keysToolbar}
        onClearFilters={clearServerFilters}
        hasExternalFilters={hasServerFilters}
      />
    </div>
  );
}
