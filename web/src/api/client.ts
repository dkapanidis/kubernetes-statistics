import type { Resource, ResourceDetail, Stats } from "../types";

const BASE = "/api";

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/stats`);
  return res.json();
}

export async function fetchResources(params?: {
  cluster?: string;
  namespace?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}): Promise<Resource[]> {
  const query = new URLSearchParams();
  if (params?.cluster) query.set("cluster", params.cluster);
  if (params?.namespace) query.set("namespace", params.namespace);
  if (params?.kind) query.set("kind", params.kind);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const res = await fetch(`${BASE}/resources?${query}`);
  return res.json();
}

export async function fetchResource(id: number): Promise<ResourceDetail> {
  const res = await fetch(`${BASE}/resources/${id}`);
  return res.json();
}
