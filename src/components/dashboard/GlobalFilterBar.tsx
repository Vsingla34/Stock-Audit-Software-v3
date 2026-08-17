// src/components/dashboard/GlobalFilterBar.tsx
// Fix 4.5 — Global filter bar persisted in URL params
// Place this above any page content to give users a shared date/status filter.
// Filters write to URL so they survive navigation and are shareable.

import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export function useGlobalFilters() {
  const [params, setParams] = useSearchParams();

  const status   = params.get("gStatus")   || "all";
  const category = params.get("gCategory") || "all";
  const dateFrom = params.get("gFrom")     || "";
  const dateTo   = params.get("gTo")       || "";

  const set = useCallback(
    (key: string, value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === "all" || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const isActive = status !== "all" || category !== "all" || !!dateFrom || !!dateTo;

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ["gStatus", "gCategory", "gFrom", "gTo"].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true }
    );
  }, [setParams]);

  return {
    status, category, dateFrom, dateTo, isActive,
    setStatus:   (v: string) => set("gStatus",   v),
    setCategory: (v: string) => set("gCategory", v),
    setDateFrom: (v: string) => set("gFrom",     v),
    setDateTo:   (v: string) => set("gTo",       v),
    reset,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GlobalFilterBar = () => {
  const { status, category, dateFrom, dateTo, isActive,
          setStatus, setCategory, setDateFrom, setDateTo, reset } = useGlobalFilters();

  const { itemMaster } = useInventory();
  const { selectedCompanyId } = useCompany();

  const categories = Array.from(
    new Set(itemMaster.map((i) => i.category).filter(Boolean))
  ).sort() as string[];

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 mr-1">
        <Filter className="h-4 w-4" />
        Filter
      </div>

      {/* Status */}
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="matched">Matched</SelectItem>
          <SelectItem value="discrepancy">Discrepancy</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      {/* Category */}
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <span>From</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 rounded-md border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span>To</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 rounded-md border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-gray-500 hover:text-gray-800 ml-auto"
          onClick={reset}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
};