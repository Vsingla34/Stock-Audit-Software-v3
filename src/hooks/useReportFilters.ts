import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

export type StatusFilter = "all" | "matched" | "discrepancy" | "pending";
// SortOrder includes all values used in Reports.tsx sort dropdowns
export type SortOrder =
  | "default"
  | "asc"
  | "desc"
  | "variance-asc"
  | "variance-desc"
  | "val-variance-asc"
  | "val-variance-desc";

/**
 * Persists Reports page filter/sort state in the URL as search params.
 * This means:
 *  - Navigating away and back preserves filters
 *  - The URL is shareable / bookmarkable
 *  - The browser back button restores previous filter states
 */
export function useReportFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter  = (searchParams.get("status")   as StatusFilter) ?? "all";
  const categoryFilter = searchParams.get("category") ?? "all";
  const sortOrder     = (searchParams.get("sort")     as SortOrder)     ?? "default";
  const searchQuery   = searchParams.get("q")                           ?? "";
  const subLocFilter  = searchParams.get("subloc")                      ?? "all";

  /** Internal setter — removes the key when value is the default, to keep URLs clean */
  const setParam = useCallback(
    (key: string, value: string, defaultValue = "all") => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === defaultValue || value === "" || value === "default") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: true } // replace=true avoids flooding browser history
      );
    },
    [setSearchParams]
  );

  return {
    // Values
    statusFilter,
    categoryFilter,
    sortOrder,
    searchQuery,
    subLocFilter,

    // Setters
    setStatusFilter:   (v: string) => setParam("status",   v),
    setCategoryFilter: (v: string) => setParam("category", v),
    setSortOrder:      (v: string) => setParam("sort",     v, "default"),
    setSearchQuery:    (v: string) => setParam("q",        v, ""),
    setSubLocFilter:   (v: string) => setParam("subloc",   v),

    /** Reset all filters back to defaults (clears the URL params) */
    resetFilters: () =>
      setSearchParams({}, { replace: true }),
  };
}