import type {
  Resource,
  ResourceDetail,
  Stats,
  FilterOptions,
  GroupByResult,
  StackedGroupByResult,
  TimeseriesPoint,
  KeyValueEntry,
} from "../types";

const BASE = "/api";

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/stats`);
  return res.json();
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const res = await fetch(`${BASE}/filter-options`);
  return res.json();
}

export async function fetchResources(params?: {
  cluster?: string;
  namespace?: string;
  kind?: string;
  name?: string;
  source?: string;
  asOf?: string;
  limit?: number;
  offset?: number;
}): Promise<Resource[]> {
  const query = new URLSearchParams();
  if (params?.cluster) query.set("cluster", params.cluster);
  if (params?.namespace) query.set("namespace", params.namespace);
  if (params?.kind) query.set("kind", params.kind);
  if (params?.name) query.set("name", params.name);
  if (params?.source) query.set("source", params.source);
  if (params?.asOf) query.set("asOf", params.asOf);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const res = await fetch(`${BASE}/resources?${query}`);
  return res.json();
}

export async function fetchResource(id: number): Promise<ResourceDetail> {
  const res = await fetch(`${BASE}/resources/${id}`);
  return res.json();
}

export async function fetchKeyValues(params?: {
  key?: string;
  value?: string;
  op?: string;
  kind?: string;
  cluster?: string;
  namespace?: string;
  name?: string;
  asOf?: string;
  limit?: number;
  offset?: number;
}): Promise<KeyValueEntry[]> {
  const query = new URLSearchParams();
  if (params?.key) query.set("key", params.key);
  if (params?.value) query.set("value", params.value);
  if (params?.op) query.set("op", params.op);
  if (params?.kind) query.set("kind", params.kind);
  if (params?.cluster) query.set("cluster", params.cluster);
  if (params?.namespace) query.set("namespace", params.namespace);
  if (params?.name) query.set("name", params.name);
  if (params?.asOf) query.set("asOf", params.asOf);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const res = await fetch(`${BASE}/key-values?${query}`);
  return res.json();
}

export async function fetchKeys(kind?: string, search?: string, limit?: number): Promise<string[]> {
  const q = new URLSearchParams();
  if (kind) q.set("kind", kind);
  if (search) q.set("search", search);
  if (limit) q.set("limit", String(limit));
  const qs = q.toString();
  const res = await fetch(`${BASE}/keys${qs ? `?${qs}` : ""}`);
  return res.json();
}

export interface QueryParams {
  kind?: string;
  groupBy: string;
  filterKey?: string;
  filterOp?: string;
  filterValue?: string;
  stackBy?: string;
  start?: string;
  end?: string;
  interval?: string;
}

function buildQueryString(params: QueryParams): URLSearchParams {
  const q = new URLSearchParams();
  if (params.kind) q.set("kind", params.kind);
  q.set("groupBy", params.groupBy);
  if (params.filterKey) q.set("filterKey", params.filterKey);
  if (params.filterOp) q.set("filterOp", params.filterOp);
  if (params.filterValue) q.set("filterValue", params.filterValue);
  if (params.stackBy) q.set("stackBy", params.stackBy);
  if (params.start) q.set("start", params.start);
  if (params.end) q.set("end", params.end);
  if (params.interval) q.set("interval", params.interval);
  return q;
}

export async function fetchGroupBy(params: QueryParams): Promise<GroupByResult[]> {
  const res = await fetch(`${BASE}/query?${buildQueryString(params)}`);
  return res.json();
}

export async function fetchStackedGroupBy(params: QueryParams): Promise<StackedGroupByResult[]> {
  const res = await fetch(`${BASE}/query/stacked?${buildQueryString(params)}`);
  return res.json();
}

export async function fetchTimeseries(params: QueryParams): Promise<TimeseriesPoint[]> {
  const res = await fetch(`${BASE}/query/timeseries?${buildQueryString(params)}`);
  return res.json();
}
