// src/components/audit/ItemHistoryPopover.tsx
// Build 01 — inline "who changed this count, and when" per row.
// Higher-value surface than a standalone page per the spec: answers the
// question people actually ask, without navigating away from the table.

import { useState } from "react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { History, Loader2, User, ArrowRight } from "lucide-react";
import SupabaseDataService, { AuditLogRow } from "@/services/SupabaseDataService";
import { useCompany } from "@/context/CompanyContext";
import { formatDistanceToNow } from "date-fns";

interface ItemHistoryPopoverProps {
  itemId: string;
  itemName?: string;
}

// Human-readable label for a changed field
const FIELD_LABELS: Record<string, string> = {
  physical_quantity: "Physical Qty",
  system_quantity:   "System Qty",
  status:            "Status",
  auditor_entries:   "Scan Entries",
};

const ActionBadge = ({ action }: { action: string }) => {
  const cfg: Record<string, string> = {
    insert: "bg-emerald-50 text-emerald-700 border-emerald-100",
    update: "bg-amber-50 text-amber-700 border-amber-100",
    delete: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg[action] || cfg.update}`}>
      {action.toUpperCase()}
    </span>
  );
};

const DiffRow = ({ field, before, after }: { field: string; before: any; after: any }) => (
  <div className="flex items-center gap-2 text-[11px] py-1">
    <span className="text-slate-400 w-24 shrink-0">{FIELD_LABELS[field] || field}</span>
    <span className="text-slate-500 line-through decoration-red-300">
      {before === null || before === undefined ? "—" : String(before)}
    </span>
    <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
    <span className="text-slate-800 font-medium">
      {after === null || after === undefined ? "—" : String(after)}
    </span>
  </div>
);

export const ItemHistoryPopover = ({ itemId, itemName }: ItemHistoryPopoverProps) => {
  const { selectedCompanyId } = useCompany();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows]       = useState<AuditLogRow[]>([]);
  const [fetched, setFetched] = useState(false);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next && !fetched && selectedCompanyId) {
      setLoading(true);
      try {
        const data = await (SupabaseDataService as any).getItemAuditLog(itemId, selectedCompanyId);
        setRows(data);
        setFetched(true);
      } catch (e) {
        console.error("Failed to load item history:", e);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-400 hover:text-violet-600 hover:bg-violet-50"
          title="View history"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 max-h-96 overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50">
          <p className="text-[13px] font-semibold text-slate-700 truncate">
            {itemName ? `History — ${itemName}` : "Item History"}
          </p>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[12px] text-slate-400">
              No changes recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.id} className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-slate-400" />
                      <span className="text-[12px] font-medium text-slate-700">
                        {r.actor_email || "System"}
                      </span>
                      <ActionBadge action={r.action} />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(r.occurred_at), { addSuffix: true })}
                    </span>
                  </div>

                  {r.changed_fields && r.changed_fields.length > 0 && (
                    <div className="pl-4 space-y-0.5">
                      {r.changed_fields
                        .filter((f) => f !== "auditor_entries" && f !== "updated_at")
                        .map((f) => (
                          <DiffRow
                            key={f}
                            field={f}
                            before={r.before?.[f]}
                            after={r.after?.[f]}
                          />
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};