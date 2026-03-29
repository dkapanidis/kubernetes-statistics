import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFilterOptions, fetchKeys } from "../api/client";
import type { WidgetConfig } from "../types";
import FilterInput from "./FilterInput";

const TYPES: WidgetConfig["type"][] = ["counter", "bar", "table", "timeseries"];
const RESOURCE_FIELDS = ["kind", "cluster", "namespace", "name"];
const FILTER_OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "like", label: "like" },
];
const COUNTER_COLORS = [
  { value: "text-blue-600", label: "Blue" },
  { value: "text-green-600", label: "Green" },
  { value: "text-purple-600", label: "Purple" },
  { value: "text-red-600", label: "Red" },
  { value: "text-yellow-600", label: "Yellow" },
  { value: "text-pink-600", label: "Pink" },
];
const BAR_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ef4444", label: "Red" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Yellow" },
  { value: "#ec4899", label: "Pink" },
];

interface Props {
  widget?: WidgetConfig;
  onSave: (widget: WidgetConfig) => void;
  onCancel: () => void;
}

export default function WidgetEditor({ widget, onSave, onCancel }: Props) {
  const [type, setType] = useState<WidgetConfig["type"]>(widget?.type || "bar");
  const [title, setTitle] = useState(widget?.title || "");
  const [kind, setKind] = useState(widget?.query.kind || "*");
  const [groupBy, setGroupBy] = useState(widget?.query.groupBy || "kind");
  const [counterMode, setCounterMode] = useState<"total" | "distinct">(
    widget?.counterMode || "total",
  );
  const [color, setColor] = useState(widget?.color || "text-blue-600");
  const [barColor, setBarColor] = useState(widget?.barColor || "#3b82f6");
  const [filterKey, setFilterKey] = useState(widget?.query.filterKey || "");
  const [filterOp, setFilterOp] = useState(widget?.query.filterOp || "eq");
  const [filterValue, setFilterValue] = useState(widget?.query.filterValue || "");
  const [stackBy, setStackBy] = useState(widget?.query.stackBy || "");

  const { data: kinds = [] } = useQuery({
    queryKey: ["filterOptions"],
    queryFn: fetchFilterOptions,
    select: (opts) => opts.kinds,
  });

  const { data: keys = [] } = useQuery({
    queryKey: ["keys", kind],
    queryFn: () => fetchKeys(kind),
    enabled: !!kind && kind !== "*",
  });

  const groupByOptions = [...RESOURCE_FIELDS, ...keys.filter((k) => !RESOURCE_FIELDS.includes(k))];

  function handleSave() {
    onSave({
      id: widget?.id || crypto.randomUUID(),
      type,
      title: title || `${type} - ${groupBy}`,
      query: {
        kind,
        groupBy,
        filterKey: filterKey || undefined,
        filterOp: filterKey ? filterOp : undefined,
        filterValue: filterKey ? filterValue || undefined : undefined,
        stackBy: stackBy || undefined,
      },
      counterMode: type === "counter" ? counterMode : undefined,
      color: type === "counter" ? color : undefined,
      barColor: type === "bar" ? barColor : undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg space-y-4">
        <h3 className="text-lg font-semibold">
          {widget ? "Edit Widget" : "Add Widget"}
        </h3>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                className={`px-3 py-1.5 rounded text-sm ${
                  type === t
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input
            className="w-full border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Widget title"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Kind</label>
          <FilterInput
            label="kind"
            value={kind}
            options={["*", ...kinds]}
            onChange={(v) => setKind(v)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Group By</label>
          <FilterInput
            label="group by"
            value={groupBy}
            options={groupByOptions}
            onChange={(v) => setGroupBy(v)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Filter (optional)</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <FilterInput
                label="key"
                value={filterKey}
                options={groupByOptions}
                onChange={(v) => setFilterKey(v)}
              />
            </div>
            <select
              className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value)}
            >
              {FILTER_OPS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              className="flex-1 border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="value"
            />
          </div>
        </div>

        {type === "bar" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stack By (optional)</label>
            <FilterInput
              label="stack by"
              value={stackBy}
              options={["", ...groupByOptions]}
              onChange={(v) => setStackBy(v)}
            />
          </div>
        )}

        {type === "counter" && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Counter Mode</label>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1.5 rounded text-sm ${
                    counterMode === "total"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                  onClick={() => setCounterMode("total")}
                >
                  Total (sum)
                </button>
                <button
                  className={`px-3 py-1.5 rounded text-sm ${
                    counterMode === "distinct"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                  onClick={() => setCounterMode("distinct")}
                >
                  Distinct (count)
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COUNTER_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`px-3 py-1.5 rounded text-sm font-bold ${c.value} ${
                      color === c.value
                        ? "ring-2 ring-blue-500 bg-gray-100 dark:bg-gray-700"
                        : "bg-gray-50 dark:bg-gray-700/50"
                    }`}
                    onClick={() => setColor(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {type === "bar" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bar Color</label>
            <div className="flex gap-2 flex-wrap">
              {BAR_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`w-8 h-8 rounded ${
                    barColor === c.value ? "ring-2 ring-blue-500" : ""
                  }`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setBarColor(c.value)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleSave}
          >
            {widget ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
