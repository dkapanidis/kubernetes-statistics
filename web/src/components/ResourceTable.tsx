import { useEffect, useState, useRef, useCallback } from "react";
import { fetchResources, fetchFilterOptions } from "../api/client";
import type { Resource, FilterOptions } from "../types";
import FilterInput from "./FilterInput";
import type { FilterInputHandle } from "./FilterInput";
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
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <ThFilter label="Name" value={filters.name} onToggle={() => refs.name.current?.toggle()}>
                <FilterInput ref={refs.name} label="name" value={filters.name} options={options.names} onChange={(v) => setFilters((f) => ({ ...f, name: v }))} compact />
              </ThFilter>
              <ThFilter label="Cluster" value={filters.cluster} onToggle={() => refs.cluster.current?.toggle()}>
                <FilterInput ref={refs.cluster} label="cluster" value={filters.cluster} options={options.clusters} onChange={(v) => setFilters((f) => ({ ...f, cluster: v }))} compact />
              </ThFilter>
              <ThFilter label="Namespace" value={filters.namespace} onToggle={() => refs.namespace.current?.toggle()}>
                <FilterInput ref={refs.namespace} label="namespace" value={filters.namespace} options={options.namespaces} onChange={(v) => setFilters((f) => ({ ...f, namespace: v }))} compact />
              </ThFilter>
              <ThFilter label="Kind" value={filters.kind} onToggle={() => refs.kind.current?.toggle()}>
                <FilterInput ref={refs.kind} label="kind" value={filters.kind} options={options.kinds} onChange={(v) => setFilters((f) => ({ ...f, kind: v }))} compact />
              </ThFilter>
              <th className="px-4 py-3">First Seen</th>
              <th className="px-4 py-3">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr
                key={r.id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-4 py-2 font-mono group/cell">
                  <span className="flex items-center gap-1.5">
                    <button
                      className="text-blue-500 hover:text-blue-400 hover:underline text-left"
                      onClick={() => onSelect(r.id)}
                    >
                      {r.name}
                    </button>
                    <CopyButton text={r.name} />
                  </span>
                </td>
                <td className="px-4 py-2 group/cell">
                  <span className="flex items-center gap-1.5">
                    {r.cluster}
                    <CopyButton text={r.cluster} />
                  </span>
                </td>
                <td className="px-4 py-2 group/cell">
                  <span className="flex items-center gap-1.5">
                    {r.namespace}
                    <CopyButton text={r.namespace} />
                  </span>
                </td>
                <td className="px-4 py-2 group/cell">
                  <span className="flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
                      {r.kind}
                    </span>
                    <CopyButton text={r.kind} />
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500 group/cell">
                  <span className="flex items-center gap-1.5">
                    {new Date(r.firstSeen).toLocaleDateString()}
                    <CopyButton text={new Date(r.firstSeen).toLocaleDateString()} />
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500 group/cell">
                  <span className="flex items-center gap-1.5">
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
      <div className="p-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
        {resources.length} resources shown
      </div>
    </div>
  );
}

function ThFilter({
  label,
  value,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 relative">
      <span
        className="flex items-center gap-1.5 cursor-pointer hover:text-blue-500 select-none"
        onClick={onToggle}
      >
        {label}
        {value ? (
          <span className="text-blue-500 normal-case font-normal text-xs truncate max-w-[6rem]">({value})</span>
        ) : (
          <svg
            className="w-3 h-3 text-gray-400 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
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
