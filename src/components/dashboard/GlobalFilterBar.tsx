// src/components/dashboard/GlobalFilterBar.tsx
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

  const set = useCallback((key: string, value: string) => {
      setParams((prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === "all" || value === "") next.delete(key);
          else next.set(key, value);
          return next;
        }, { replace: true });
    }, [setParams]);

  const isActive = status !== "all" || category !== "all" || !!dateFrom || !!dateTo;
  const reset = useCallback(() => {
    setParams((prev) => {
        const next = new URLSearchParams(prev);
        ["gStatus", "gCategory", "gFrom", "gTo"].forEach((k) => next.delete(k));
        return next;
      }, { replace: true });
  }, [setParams]);

  return { status, category, dateFrom, dateTo, isActive, setStatus: (v: string) => set("gStatus", v), setCategory: (v: string) => set("gCategory", v), setDateFrom: (v: string) => set("gFrom", v), setDateTo: (v: string) => set("gTo", v), reset };
}

export const GlobalFilterBar = () => {
  const { status, category, dateFrom, dateTo, isActive, setStatus, setCategory, setDateFrom, setDateTo, reset } = useGlobalFilters();
  const { itemMaster } = useInventory();
  
  const categories = Array.from(new Set(itemMaster.map((i) => i.category).filter(Boolean))).sort() as string[];

  return (
    <div className="flex flex-wrap items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest pl-2 pr-1">
        <Filter className="h-3.5 w-3.5 text-blue-600" />
        Filter
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 w-36 text-xs bg-slate-50 border-slate-200 text-slate-800 rounded-md focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition-colors">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="bg-white border-slate-200 text-slate-800">
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="matched">Matched</SelectItem>
          <SelectItem value="discrepancy">Discrepancy</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="h-8 w-40 text-xs bg-slate-50 border-slate-200 text-slate-800 rounded-md focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition-colors">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent className="bg-white border-slate-200 text-slate-800">
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <span className="uppercase tracking-wider text-[10px] font-bold">From</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 rounded-md bg-slate-50 border border-slate-200 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition-colors"
        />
        <span className="uppercase tracking-wider text-[10px] font-bold">To</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 rounded-md bg-slate-50 border border-slate-200 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition-colors"
        />
      </div>

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md ml-auto transition-all"
          onClick={reset}
        >
          <X className="h-3.5 w-3.5" />
          Clear Filter
        </Button>
      )}
    </div>
  );
};