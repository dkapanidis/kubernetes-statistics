import type { SetURLSearchParams } from "react-router-dom";

type SortDir = "asc" | "desc" | null;

/** Decode URL search params into DataTable filters (f.key=val1,val2) */
export function paramsToFilters(sp: URLSearchParams): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  sp.forEach((v, k) => {
    if (k.startsWith("f.") && v) {
      filters[k.slice(2)] = v.split(",");
    }
  });
  return filters;
}

/** Decode sort from URL search params (sort=key&dir=asc|desc) */
export function paramsToSort(sp: URLSearchParams): { key: string; dir: SortDir } | undefined {
  const key = sp.get("sort");
  const dir = sp.get("dir") as SortDir;
  if (key && (dir === "asc" || dir === "desc")) {
    return { key, dir };
  }
  return undefined;
}

/** Write DataTable filters back to URL search params */
export function writeFilters(
  setSearchParams: SetURLSearchParams,
  filters: Record<string, string[]>,
) {
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    // Remove old filter params
    [...next.keys()].filter((k) => k.startsWith("f.")).forEach((k) => next.delete(k));
    // Add new ones
    for (const [k, vals] of Object.entries(filters)) {
      if (vals.length > 0) next.set("f." + k, vals.join(","));
    }
    return next;
  }, { replace: true });
}

/** Write sort state back to URL search params */
export function writeSort(
  setSearchParams: SetURLSearchParams,
  key: string | null,
  dir: SortDir,
) {
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (key && dir) {
      next.set("sort", key);
      next.set("dir", dir);
    } else {
      next.delete("sort");
      next.delete("dir");
    }
    return next;
  }, { replace: true });
}
