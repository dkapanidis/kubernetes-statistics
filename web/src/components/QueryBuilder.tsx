import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchFilterOptions,
  fetchKeys,
  fetchGroupBy,
  fetchTimeseries,
} from "../api/client";
import type { QueryParams } from "../api/client";
import {
  EMPTY_FILTER_OPTIONS,
  type GroupByResult,
  type TimeseriesPoint,
} from "../types";
import { parseQuery, serializeQuery, getSuggestions } from "../lib/queryDsl";
import FilterInput from "./FilterInput";
import DataTable from "./DataTable";
import type { ColumnDef } from "./DataTable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--tooltip-bg, #1f2937)",
    border: "1px solid var(--tooltip-border, #374151)",
    borderRadius: "0.375rem",
    color: "var(--tooltip-text, #e5e7eb)",
  },
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fillMissingDates(
  data: TimeseriesPoint[],
  start: string,
  end: string,
  interval: string,
): TimeseriesPoint[] {
  const allDates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (current <= endDate) {
    allDates.push(formatDate(current));
    if (interval === "week") current.setDate(current.getDate() + 7);
    else if (interval === "month") current.setMonth(current.getMonth() + 1);
    else current.setDate(current.getDate() + 1);
  }
  const dataMap = new Map(data.map((p) => [p.date, p]));
  return allDates.map((d) => dataMap.get(d) || { date: d, values: {} });
}

const FILTER_OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "like", label: "LIKE" },
];

type ViewMode = "table" | "bar" | "timeseries";

interface QueryBuilderProps {
  searchParams: URLSearchParams;
  setSearchParams: (fn: (prev: URLSearchParams) => URLSearchParams, opts?: { replace?: boolean }) => void;
}

export default function QueryBuilder({ searchParams, setSearchParams }: QueryBuilderProps) {
  const { data: options = EMPTY_FILTER_OPTIONS } =
    useQuery({ queryKey: ["filterOptions"], queryFn: fetchFilterOptions });

  const [keys, setKeys] = useState<string[]>([]);

  // Initialize form state from URL params
  const [kind, setKindRaw] = useState(searchParams.get("kind") || "");
  const [groupBy, setGroupByRaw] = useState(searchParams.get("groupBy") || "");
  const [filterKey, setFilterKeyRaw] = useState(searchParams.get("filterKey") || "");
  const [filterOp, setFilterOpRaw] = useState(searchParams.get("filterOp") || "eq");
  const [filterValue, setFilterValueRaw] = useState(searchParams.get("filterValue") || "");
  const [interval, setIntervalRaw] = useState(searchParams.get("interval") || "day");
  const [range, setRangeRaw] = useState<7 | 30>((Number(searchParams.get("range")) === 30 ? 30 : 7));
  const [view, setViewRaw] = useState<ViewMode>((searchParams.get("view") as ViewMode) || "bar");

  // Sync form field to URL
  const syncParam = useCallback((key: string, value: string, defaultValue = "") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== defaultValue) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setKind = useCallback((v: string) => { setKindRaw(v); syncParam("kind", v); }, [syncParam]);
  const setGroupBy = useCallback((v: string) => { setGroupByRaw(v); syncParam("groupBy", v); }, [syncParam]);
  const setFilterKey = useCallback((v: string) => { setFilterKeyRaw(v); syncParam("filterKey", v); }, [syncParam]);
  const setFilterOp = useCallback((v: string) => { setFilterOpRaw(v); syncParam("filterOp", v, "eq"); }, [syncParam]);
  const setFilterValue = useCallback((v: string) => { setFilterValueRaw(v); syncParam("filterValue", v); }, [syncParam]);
  const setInterval = useCallback((v: string) => { setIntervalRaw(v); syncParam("interval", v, "day"); }, [syncParam]);
  const setRange = useCallback((v: 7 | 30) => { setRangeRaw(v); syncParam("range", String(v), "7"); }, [syncParam]);
  const setView = useCallback((v: ViewMode) => { setViewRaw(v); syncParam("view", v, "bar"); }, [syncParam]);

  // DSL bar state
  const [dslInput, setDslInput] = useState("");
  const [dslSuggestions, setDslSuggestions] = useState<string[]>([]);
  const [dslHighlighted, setDslHighlighted] = useState(-1);
  const [dslOpen, setDslOpen] = useState(false);
  const dslRef = useRef<HTMLDivElement>(null);
  const dslInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);

  const [groupByResults, setGroupByResults] = useState<GroupByResult[]>([]);
  const [timeseriesResults, setTimeseriesResults] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Track whether the DSL bar or the form triggered the last update
  const updatingFrom = useRef<"dsl" | "form" | null>(null);

  const { data: fetchedKeys } = useQuery({
    queryKey: ["keys", kind],
    queryFn: () => fetchKeys(kind),
    enabled: !!kind,
  });

  useEffect(() => {
    setKeys(kind && fetchedKeys ? fetchedKeys : []);
  }, [fetchedKeys, kind]);

  // Sync form → DSL
  useEffect(() => {
    if (updatingFrom.current === "dsl") {
      updatingFrom.current = null;
      return;
    }
    const q = serializeQuery({
      kind,
      groupBy,
      filterKey,
      filterOp,
      filterValue,
    });
    setDslInput(q);
  }, [kind, groupBy, filterKey, filterOp, filterValue]);

  // Handle DSL input changes
  function handleDslChange(value: string) {
    setDslInput(value);
    const parsed = parseQuery(value);

    // Update suggestions
    const cursorPos = dslInputRef.current?.selectionStart ?? value.length;
    const suggs = getSuggestions(value, cursorPos, options.kinds, keys);
    setDslSuggestions(suggs);
    setDslHighlighted(-1);
    setDslOpen(suggs.length > 0);

    // If kind changed, fetch keys for the new kind
    if (parsed.kind && parsed.kind !== kind) {
      updatingFrom.current = "dsl";
      setKind(parsed.kind);
      fetchKeys(parsed.kind).then((newKeys) => {
        setKeys(newKeys);
      });
    }

    // Sync parsed fields to form
    updatingFrom.current = "dsl";
    if (parsed.kind !== kind) setKind(parsed.kind);
    if (parsed.groupBy !== groupBy) setGroupBy(parsed.groupBy);
    if (parsed.filterKey !== filterKey) setFilterKey(parsed.filterKey);
    if (parsed.filterOp !== filterOp) setFilterOp(parsed.filterOp);
    if (parsed.filterValue !== filterValue) setFilterValue(parsed.filterValue);
  }

  function applySuggestion(suggestion: string) {
    const beforeCursor =
      dslInput.slice(0, dslInputRef.current?.selectionStart ?? dslInput.length);
    const segments = beforeCursor.split("|");
    const segIndex = segments.length - 1;
    const currentSeg = segments[segIndex];

    // Replace the current segment's partial with the suggestion
    let newSegContent: string;
    if (segIndex === 0) {
      newSegContent = suggestion;
    } else if (segIndex === 1) {
      newSegContent = " group by " + suggestion;
    } else {
      newSegContent = " " + suggestion;
    }

    segments[segIndex] = newSegContent;

    // Check if we need a trailing pipe for the next segment
    const afterCursor =
      dslInput.slice(dslInputRef.current?.selectionStart ?? dslInput.length);
    const newValue = segments.join("|") + afterCursor;
    handleDslChange(newValue);
    setDslOpen(false);

    // Refocus
    setTimeout(() => {
      dslInputRef.current?.focus();
      const pos = segments.join("|").length;
      dslInputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleDslKeyDown(e: React.KeyboardEvent) {
    if (!dslOpen || dslSuggestions.length === 0) {
      if (e.key === "ArrowDown") {
        setDslOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setDslHighlighted((h) =>
          Math.min(h + 1, dslSuggestions.length - 1),
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setDslHighlighted((h) => Math.max(h - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (
          dslHighlighted >= 0 &&
          dslHighlighted < dslSuggestions.length
        ) {
          applySuggestion(dslSuggestions[dslHighlighted]);
        } else if (dslSuggestions.length === 1) {
          applySuggestion(dslSuggestions[0]);
        }
        break;
      case "Escape":
        setDslOpen(false);
        setDslHighlighted(-1);
        break;
      case "Tab":
        if (
          dslHighlighted >= 0 &&
          dslHighlighted < dslSuggestions.length
        ) {
          e.preventDefault();
          applySuggestion(dslSuggestions[dslHighlighted]);
        } else if (dslSuggestions.length === 1) {
          e.preventDefault();
          applySuggestion(dslSuggestions[0]);
        }
        break;
    }
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dslRef.current && !dslRef.current.contains(e.target as Node)) {
        setDslOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Form field changes sync to DSL
  function setFormField(
    setter: (v: string) => void,
    value: string,
  ) {
    updatingFrom.current = "form";
    setter(value);
  }

  const runQuery = useCallback(() => {
    if (!kind || !groupBy) return;

    const params: QueryParams = { kind, groupBy };
    if (filterKey && filterValue) {
      params.filterKey = filterKey;
      params.filterOp = filterOp;
      params.filterValue = filterValue;
    }
    params.interval = interval;

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - range);
    const startStr = formatDate(start);
    const endStr = formatDate(now);
    params.start = startStr;
    params.end = endStr;

    setLoading(true);
    Promise.all([fetchGroupBy(params), fetchTimeseries(params)])
      .then(([gb, ts]) => {
        setGroupByResults(gb);
        setTimeseriesResults(fillMissingDates(ts, startStr, endStr, interval));
      })
      .finally(() => setLoading(false));
  }, [kind, groupBy, filterKey, filterOp, filterValue, interval, range]);

  // Auto-run when key params change
  useEffect(() => {
    if (kind && groupBy) {
      runQuery();
    }
  }, [runQuery]);

  // Build timeseries chart data
  const allValues = [
    ...new Set(timeseriesResults.flatMap((p) => Object.keys(p.values))),
  ].sort();

  const chartData = timeseriesResults.map((p) => {
    const row: Record<string, string | number> = { date: p.date };
    for (const v of allValues) {
      row[v] = p.values[v] || 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      {/* DSL Query Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-blue-500 font-mono text-lg">&gt;</span>
          <div ref={dslRef} className="relative flex-1">
            <input
              ref={dslInputRef}
              className="w-full border rounded px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="PostgresCluster | group by spec.postgresVersion | spec.instances[0].replicas > 2"
              value={dslInput}
              onChange={(e) => handleDslChange(e.target.value)}
              onFocus={() => {
                const cursorPos =
                  dslInputRef.current?.selectionStart ?? dslInput.length;
                const suggs = getSuggestions(
                  dslInput,
                  cursorPos,
                  options.kinds,
                  keys,
                );
                setDslSuggestions(suggs);
                setDslOpen(suggs.length > 0);
              }}
              onKeyDown={handleDslKeyDown}
            />
            {dslOpen && dslSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto text-sm font-mono">
                {dslSuggestions.map((s, i) => (
                  <li
                    key={s}
                    className={`px-3 py-1.5 cursor-pointer ${
                      i === dslHighlighted
                        ? "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                        : "hover:bg-gray-100 dark:hover:bg-gray-600"
                    }`}
                    onClick={() => applySuggestion(s)}
                    onMouseEnter={() => setDslHighlighted(i)}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Hide form" : "Show form"}
          </button>
        </div>
        <div className="text-xs text-gray-400 font-mono">
          Syntax: &lt;kind&gt; | group by &lt;key&gt; | &lt;filterKey&gt;
          &lt;op&gt; &lt;value&gt; &nbsp; Operators: = != &gt; &gt;= &lt;
          &lt;= ~ (like)
        </div>

        {/* Collapsible form fields */}
        {showForm && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Kind
                </label>
                <FilterInput
                  label="kind"
                  value={kind}
                  options={options.kinds}
                  onChange={(v) => setFormField(setKind, v)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Group By
                </label>
                <FilterInput
                  label="key"
                  value={groupBy}
                  options={keys}
                  onChange={(v) => setFormField(setGroupBy, v)}
                />
              </div>
            </div>
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Filter Key
                </label>
                <FilterInput
                  label="filter key"
                  value={filterKey}
                  options={keys}
                  onChange={(v) => setFormField(setFilterKey, v)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Op
                </label>
                <select
                  className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
                  value={filterOp}
                  onChange={(e) => setFormField(setFilterOp, e.target.value)}
                >
                  {FILTER_OPS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Value
                </label>
                <input
                  className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 w-44"
                  placeholder="Filter value..."
                  value={filterValue}
                  onChange={(e) =>
                    setFormField(setFilterValue, e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Interval and range controls */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Range:</label>
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                className={`px-2 py-1 rounded text-xs ${
                  range === r
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200"
                }`}
                onClick={() => setRange(r)}
              >
                {r}d
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Interval:</label>
            {(["day", "week", "month"] as const).map((i) => (
              <button
                key={i}
                className={`px-2 py-1 rounded text-xs ${
                  interval === i
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200"
                }`}
                onClick={() => setInterval(i)}
              >
                {i === "day" ? "Daily" : i === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View toggle + results */}
      {kind && groupBy && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-2">
            {(["bar", "table", "timeseries"] as ViewMode[]).map((m) => (
              <button
                key={m}
                className={`px-3 py-1.5 rounded text-sm ${
                  view === m
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                onClick={() => setView(m)}
              >
                {m === "bar"
                  ? "Bar Chart"
                  : m === "table"
                    ? "Table"
                    : "Timeline"}
              </button>
            ))}
            {loading && (
              <span className="text-sm text-gray-400 ml-auto">
                Loading...
              </span>
            )}
          </div>

          <div className="p-4">
            {view === "table" && (
              <QueryTable groupBy={groupBy} data={groupByResults} />
            )}

            {view === "bar" && (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={groupByResults}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="value" tick={{ fill: "#9ca3af" }} />
                  <YAxis tick={{ fill: "#9ca3af" }} />
                  <Tooltip cursor={{ fill: "rgba(55, 65, 81, 0.5)" }} {...tooltipStyle} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {view === "timeseries" && (
              <>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af" }} />
                      <YAxis tick={{ fill: "#9ca3af" }} />
                      <Tooltip {...tooltipStyle} />
                      <Legend />
                      {allValues.map((v, i) => (
                        <Area
                          key={v}
                          type="monotone"
                          dataKey={v}
                          stackId="1"
                          fill={COLORS[i % COLORS.length]}
                          stroke={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-gray-400">
                    No time-series data yet. Timeline populates as ingestion
                    runs over multiple days.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QueryTable({ groupBy, data }: { groupBy: string; data: GroupByResult[] }) {
  const maxCount = Math.max(1, ...data.map((r) => r.count));
  const columns: ColumnDef<GroupByResult>[] = useMemo(
    () => [
      {
        key: "value",
        label: groupBy,
        getValue: (r) => r.value,
        className: "font-mono",
        defaultSort: "asc" as const,
      },
      {
        key: "count",
        label: "Count",
        getValue: (r) => String(r.count),
        className: "text-right font-mono",
      },
      {
        key: "distribution",
        label: "Distribution",
        getValue: (r) => String(r.count),
        render: (r, i) => (
          <div className="flex items-center gap-2">
            <div
              className="h-4 rounded"
              style={{
                width: `${(r.count / maxCount) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length],
                minWidth: "4px",
              }}
            />
          </div>
        ),
      },
    ],
    [groupBy, maxCount],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      rowKey={(r) => r.value}
      emptyMessage="No results"
    />
  );
}
