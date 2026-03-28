import { useState, useEffect, useCallback } from "react";

export interface Route {
  page: string;
  params: Record<string, string>;
}

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || "/";
  const [path, search] = hash.split("?");
  const page = path.replace(/^\//, "") || "dashboard";
  const params: Record<string, string> = {};
  if (search) {
    new URLSearchParams(search).forEach((v, k) => {
      params[k] = v;
    });
  }
  return { page, params };
}

function buildHash(page: string, params: Record<string, string>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const search = qs.toString();
  return `#/${page}${search ? "?" + search : ""}`;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback(
    (page: string, params: Record<string, string> = {}) => {
      window.location.hash = buildHash(page, params);
    },
    [],
  );

  const setParams = useCallback(
    (params: Record<string, string>) => {
      const current = parseHash();
      window.location.hash = buildHash(current.page, {
        ...current.params,
        ...params,
      });
    },
    [],
  );

  return { route, navigate, setParams };
}

/** Encode DataTable filters (Record<string, string[]>) into URL params with "f." prefix */
export function filtersToParams(filters: Record<string, string[]>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, vals] of Object.entries(filters)) {
    if (vals.length > 0) {
      params["f." + k] = vals.join(",");
    }
  }
  return params;
}

/** Decode URL params with "f." prefix back into DataTable filters */
export function paramsToFilters(params: Record<string, string>): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith("f.") && v) {
      filters[k.slice(2)] = v.split(",");
    }
  }
  return filters;
}
