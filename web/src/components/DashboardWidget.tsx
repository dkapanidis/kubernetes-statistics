import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGroupBy, fetchStackedGroupBy, fetchTimeseries } from "../api/client";
import type { WidgetConfig, GroupByResult, StackedGroupByResult, TimeseriesPoint } from "../types";
import DataTable from "./DataTable";
import type { ColumnDef } from "./DataTable";

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fillMissingDates(
  data: TimeseriesPoint[],
  start: string,
  end: string,
): TimeseriesPoint[] {
  const allDates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (current <= endDate) {
    allDates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  const dataMap = new Map(data.map((p) => [p.date, p]));
  return allDates.map((d) => dataMap.get(d) || { date: d, values: {} });
}
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

export default function DashboardWidget({ config }: { config: WidgetConfig }) {
  const [range, setRange] = useState<7 | 30>(7);

  const params = useMemo(
    () => ({
      kind: config.query.kind,
      groupBy: config.query.groupBy,
      filterKey: config.query.filterKey,
      filterOp: config.query.filterOp,
      filterValue: config.query.filterValue,
      stackBy: config.query.stackBy,
    }),
    [config.query.kind, config.query.groupBy, config.query.filterKey, config.query.filterOp, config.query.filterValue, config.query.stackBy],
  );

  const hasStackBy = !!config.query.stackBy && config.type === "bar";

  const tsRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - range);
    return { start: formatDate(start), end: formatDate(now) };
  }, [range]);

  const { data: groupByData = [], isLoading: gbLoading } = useQuery({
    queryKey: ["groupBy", params],
    queryFn: () => fetchGroupBy(params),
    enabled: config.type !== "timeseries" && !hasStackBy,
  });

  const { data: stackedData = [], isLoading: stackLoading } = useQuery({
    queryKey: ["stackedGroupBy", params],
    queryFn: () => fetchStackedGroupBy(params),
    enabled: hasStackBy,
  });

  const { data: rawTsData, isLoading: tsLoading } = useQuery({
    queryKey: ["timeseries", params, tsRange],
    queryFn: () => fetchTimeseries({ ...params, start: tsRange.start, end: tsRange.end }),
    enabled: config.type === "timeseries",
  });

  const data = groupByData;
  const tsData = useMemo(
    () => rawTsData ? fillMissingDates(rawTsData, tsRange.start, tsRange.end) : [],
    [rawTsData, tsRange],
  );
  const loading = config.type === "timeseries" ? tsLoading : hasStackBy ? stackLoading : gbLoading;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse h-full">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (config.type === "counter") {
    const value =
      config.counterMode === "distinct"
        ? data.length
        : data.reduce((sum, r) => sum + r.count, 0);
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-full">
        <div className={`text-3xl font-bold ${config.color || "text-blue-600"}`}>
          {value}
        </div>
        <div className="text-sm text-gray-500 mt-1">{config.title}</div>
      </div>
    );
  }

  if (config.type === "bar") {
    if (hasStackBy && stackedData.length > 0) {
      // Collect all unique stack keys
      const allStackKeys = [...new Set(stackedData.flatMap((d) => Object.keys(d.stacks)))].sort();
      // Transform to flat rows for Recharts
      const chartData = stackedData.map((d) => {
        const row: Record<string, string | number> = { value: d.value };
        for (const sk of allStackKeys) {
          row[sk] = d.stacks[sk] || 0;
        }
        return row;
      });

      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-full flex flex-col">
          <h3 className="text-lg font-semibold mb-4">{config.title}</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="value" tick={{ fill: "#9ca3af" }} />
              <YAxis tick={{ fill: "#9ca3af" }} />
              <Tooltip cursor={{ fill: "rgba(55, 65, 81, 0.5)" }} {...tooltipStyle} />
              <Legend />
              {allStackKeys.map((sk, i) => (
                <Bar key={sk} dataKey={sk} stackId="stack" fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-full flex flex-col">
        <h3 className="text-lg font-semibold mb-4">{config.title}</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="value" tick={{ fill: "#9ca3af" }} />
            <YAxis tick={{ fill: "#9ca3af" }} />
            <Tooltip cursor={{ fill: "rgba(55, 65, 81, 0.5)" }} {...tooltipStyle} />
            <Bar dataKey="count" fill={config.barColor || "#3b82f6"} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (config.type === "table") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-full">
        <h3 className="text-lg font-semibold mb-4">{config.title}</h3>
        <DashboardTable groupBy={config.query.groupBy} data={data} />
      </div>
    );
  }

  if (config.type === "timeseries") {
    const allValues = [...new Set(tsData.flatMap((p) => Object.keys(p.values)))].sort();
    const chartData = tsData.map((p) => {
      const row: Record<string, string | number> = { date: p.date };
      for (const v of allValues) {
        row[v] = p.values[v] || 0;
      }
      return row;
    });

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{config.title}</h3>
          <div className="flex items-center gap-1">
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
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9ca3af" }} />
              <YAxis tick={{ fill: "#9ca3af" }} />
              <Tooltip wrapperStyle={{ zIndex: 10 }} {...tooltipStyle} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 12, maxHeight: 60, overflowY: "auto" }} />
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
          <div className="py-12 text-center text-gray-400">No time-series data</div>
        )}
      </div>
    );
  }

  return null;
}

function DashboardTable({ groupBy, data }: { groupBy: string; data: GroupByResult[] }) {
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
