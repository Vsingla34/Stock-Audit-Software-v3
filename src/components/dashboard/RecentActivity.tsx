// src/components/dashboard/RecentActivity.tsx
//
// Built on Build 01's immutable audit_log — same data source as before,
// but now with infinite scroll instead of a click-through "Load More"
// button. A fixed-height scrollable container with an IntersectionObserver
// sentinel at the bottom auto-fetches the next page as you scroll near it,
// so it behaves like a continuous feed of ALL logged changes while still
// only rendering/fetching what's actually needed (no unbounded list, no
// loading the whole audit_log table into memory).

import { useState, useEffect, useCallback, useRef } from "react";
import { useCompany } from "@/context/CompanyContext";
import SupabaseDataService, { AuditLogRow } from "@/services/SupabaseDataService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  User, ArrowRight, PackageCheck, Loader2, History,
} from "lucide-react";

const PAGE_SIZE = 20;

// ── Field label + formatting ──────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  physical_quantity: "Physical Qty",
  system_quantity:   "System Qty",
  status:            "Status",
};

// Only used for the "status" field's value — physical/system qty numbers
// stay in the default neutral colour, matching the same red/green/amber
// convention used everywhere else in the app (statusConfig.ts).
const STATUS_VALUE_COLOR: Record<string, string> = {
  discrepancy: "text-red-600",
  matched:     "text-emerald-600",
  pending:     "text-amber-600",
};

const ActionDot = ({ action }: { action: string }) => {
  const color: Record<string, string> = {
    insert: "bg-emerald-500",
    update: "bg-amber-500",
    delete: "bg-red-500",
  };
  return <span className={`h-2 w-2 rounded-full shrink-0 ${color[action] || color.update}`} />;
};

// ── Single row ───────────────────────────────────────────────────────────

const ActivityRow = ({ row }: { row: AuditLogRow }) => {
  const itemName =
    row.after?.name || row.before?.name || row.after?.sku || row.before?.sku || "Item";
  const itemSku = row.after?.sku || row.before?.sku;

  const relevantFields = (row.changed_fields || []).filter(
    (f) => f === "physical_quantity" || f === "system_quantity" || f === "status"
  );

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="mt-1.5"><ActionDot action={row.action} /></div>

      <div className="h-7 w-7 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
        <PackageCheck className="h-3.5 w-3.5 text-violet-500" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-slate-800 truncate">
            {itemName}
            {itemSku && <span className="text-slate-400 font-normal"> · {itemSku}</span>}
          </p>
          <span className="text-[10px] text-slate-400 shrink-0">
            {formatDistanceToNow(new Date(row.occurred_at), { addSuffix: true })}
          </span>
        </div>

        {relevantFields.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {relevantFields.map((f) => {
              const beforeVal = row.before?.[f] ?? "—";
              const afterVal  = row.after?.[f] ?? "—";
              const beforeColor = f === "status" ? STATUS_VALUE_COLOR[beforeVal] : undefined;
              const afterColor  = f === "status" ? STATUS_VALUE_COLOR[afterVal]  : undefined;

              return (
                <div key={f} className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">{FIELD_LABELS[f] || f}</span>
                  <span
                    className={`line-through decoration-red-300 ${beforeColor || "text-slate-500"}`}
                  >
                    {beforeVal}
                  </span>
                  <ArrowRight className="h-3 w-3 text-slate-300" />
                  <span className={`font-medium ${afterColor || "text-slate-800"}`}>
                    {afterVal}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 mt-1">
          <User className="h-2.5 w-2.5 text-slate-300" />
          <span className="text-[10px] text-slate-400 truncate">
            {row.actor_email || "System"}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

export const RecentActivity = () => {
  const { selectedCompanyId, selectedAssignmentId } = useCompany();

  const [rows, setRows]           = useState<AuditLogRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [offset, setOffset]       = useState(0);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Guards against the observer firing a second fetch while one is
  // already in flight (e.g. fast scrolling past the sentinel repeatedly).
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (nextOffset: number, replace: boolean) => {
    if (!selectedCompanyId) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (replace) setLoading(true); else setLoadingMore(true);

    try {
      const { rows: newRows, total: newTotal } = await (SupabaseDataService as any).getAuditLog({
        companyId: selectedCompanyId,
        assignmentId: selectedAssignmentId || undefined,
        entityType: "inventory_items",
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setRows((prev) => (replace ? newRows : [...prev, ...newRows]));
      setTotal(newTotal);
      setOffset(nextOffset);
    } catch (e) {
      console.error("Failed to load activity log:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [selectedCompanyId, selectedAssignmentId]);

  // Reset and reload from the top whenever company/assignment changes.
  useEffect(() => {
    setRows([]);
    setOffset(0);
    fetchPage(0, true);
  }, [selectedCompanyId, selectedAssignmentId]); // eslint-disable-line

  const hasMore = rows.length < total;

  // Infinite scroll: watch a 1px sentinel at the bottom of the list.
  // When it enters the viewport of the scroll container, fetch the next
  // page. root is scoped to the scrollable div itself (not the whole
  // page), so this only fires from scrolling within the activity box.
  useEffect(() => {
    if (!sentinelRef.current || !scrollContainerRef.current) return;
    if (loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
          fetchPage(offset + PAGE_SIZE, false);
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "100px", // start fetching slightly before it's visible
        threshold: 0,
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [offset, hasMore, loading, fetchPage]);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <History className="h-4 w-4 text-violet-500" />
          Recent Activity
        </CardTitle>
        {total > 0 && (
          <span className="text-[11px] text-slate-400">
            Showing {rows.length} of {total}
          </span>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-slate-400">
            No activity recorded yet.
          </div>
        ) : (
          // Fixed-height scrollable container — this is what gives the
          // "scrollbar thing" behaviour: the box itself scrolls
          // independently of the page, and the sentinel at the bottom
          // triggers loading the next page automatically.
          <div
            ref={scrollContainerRef}
            className="max-h-[320px] overflow-y-auto pr-1 -mr-1"
          >
            {rows.map((r) => <ActivityRow key={r.id} row={r} />)}

            {/* Sentinel — invisible, just a trigger for the observer */}
            <div ref={sentinelRef} className="h-px" />

            {loadingMore && (
              <div className="flex items-center justify-center py-3 text-[12px] text-slate-400 gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more…
              </div>
            )}

            {!hasMore && rows.length > 0 && (
              <div className="text-center py-3 text-[11px] text-slate-300">
                — End of activity log —
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};