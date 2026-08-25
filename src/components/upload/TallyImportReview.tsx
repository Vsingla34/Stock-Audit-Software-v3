// src/components/upload/TallyImportReview.tsx
//
// Reconciliation step shown after godown mapping, before anything is
// actually written. Compares the Tally file's SKUs against the current
// Item Master so the admin can see exactly what will happen:
//
//   - New       items in the Tally file, not currently in Item Master
//   - Updated   items in both — Tally's values will overwrite/merge in
//   - Unmatched items currently in Item Master, but absent from this
//               Tally file — these are NOT touched or deleted, just
//               flagged so nothing goes stale unnoticed (e.g. an export
//               filter excluded them, or they're genuinely discontinued)

import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PackagePlus, RefreshCw, AlertTriangle, Loader2, ArrowRight,
} from "lucide-react";
import type { TallyParsedItem } from "./utils/tallyUtils";
import type { InventoryItem } from "@/context/InventoryContext";

interface TallyImportReviewProps {
  open: boolean;
  loading: boolean;         // true while fetching current Item Master to diff against
  importing: boolean;       // true while the actual write is in progress
  tallyItems: TallyParsedItem[];
  existingMaster: InventoryItem[];
  onCancel: () => void;
  onProceed: () => void;
}

export const TallyImportReview = ({
  open, loading, importing, tallyItems, existingMaster, onCancel, onProceed,
}: TallyImportReviewProps) => {

  // Unmatched can legitimately run into the hundreds (e.g. Item Master
  // built from an unrelated earlier CSV upload with a totally different
  // SKU scheme). Collapse it by default in that case so it doesn't
  // visually dominate over the New/Updated lists, which are what the
  // admin actually needs to confirm before importing.
  const [unmatchedExpanded, setUnmatchedExpanded] = useState(false);

  const diff = useMemo(() => {
    const existingBySku = new Map(existingMaster.map((i) => [i.sku.trim(), i]));
    const tallySkuSet = new Set(tallyItems.map((i) => i.sku.trim()));

    const newItems: TallyParsedItem[] = [];
    const updatedItems: TallyParsedItem[] = [];

    tallyItems.forEach((item) => {
      if (existingBySku.has(item.sku.trim())) updatedItems.push(item);
      else newItems.push(item);
    });

    const unmatchedItems = existingMaster.filter((i) => !tallySkuSet.has(i.sku.trim()));

    return { newItems, updatedItems, unmatchedItems };
  }, [tallyItems, existingMaster]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !importing && onCancel()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Review Before Import</DialogTitle>
          <DialogDescription>
            Here's what this Tally file will change in your Item Master. Nothing is
            written yet.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <p className="text-sm text-gray-500">Comparing against current Item Master…</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">

            {/* ── Summary counts ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center">
                <PackagePlus className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-700">{diff.newItems.length}</p>
                <p className="text-[11px] text-emerald-600">New</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-center">
                <RefreshCw className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-blue-700">{diff.updatedItems.length}</p>
                <p className="text-[11px] text-blue-600">Updated</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-center">
                <AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-amber-700">{diff.unmatchedItems.length}</p>
                <p className="text-[11px] text-amber-600">Unmatched</p>
              </div>
            </div>

            {/* ── New items list — the thing you're actually about to create ── */}
            {diff.newItems.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50">
                <div className="px-3 py-2 border-b border-emerald-200 flex items-center gap-2">
                  <PackagePlus className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <p className="text-[12px] font-semibold text-emerald-800">
                    New items — will be created ({diff.newItems.length})
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-1">
                  {diff.newItems.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between text-[12px]">
                      <span className="text-gray-700 truncate">
                        {item.name} <span className="text-gray-400">· {item.sku}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-gray-500 font-mono text-[11px]">
                          qty: {item.systemQuantity}
                        </span>
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
                          {item.category || "Uncategorised"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Updated items list — existing SKUs whose values will change ── */}
            {diff.updatedItems.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50">
                <div className="px-3 py-2 border-b border-blue-200 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <p className="text-[12px] font-semibold text-blue-800">
                    Updated items — values will be overwritten ({diff.updatedItems.length})
                  </p>
                </div>
                <div className="max-h-32 overflow-y-auto px-3 py-2 space-y-1">
                  {diff.updatedItems.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between text-[12px]">
                      <span className="text-gray-700 truncate">
                        {item.name} <span className="text-gray-400">· {item.sku}</span>
                      </span>
                      <span className="text-gray-500 font-mono text-[11px] shrink-0 ml-2">
                        new qty: {item.systemQuantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {diff.unmatchedItems.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50">
                <button
                  type="button"
                  onClick={() => setUnmatchedExpanded((v) => !v)}
                  className="w-full px-3 py-2 border-b border-amber-200 flex items-center justify-between gap-2 hover:bg-amber-100/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <p className="text-[12px] font-semibold text-amber-800">
                      In Item Master but not in this Tally file ({diff.unmatchedItems.length})
                    </p>
                  </span>
                  <span className="text-[11px] text-amber-600 shrink-0">
                    {unmatchedExpanded ? "Hide list" : "Show list"}
                  </span>
                </button>
                {unmatchedExpanded && (
                  <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-1">
                    {diff.unmatchedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-700 truncate">
                          {item.name} <span className="text-gray-400">· {item.sku}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2 border-amber-300 text-amber-700">
                          {item.category || "Uncategorised"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-3 py-2 border-t border-amber-200">
                  <p className="text-[11px] text-amber-700">
                    These items are <strong>left untouched</strong> — not deleted, not modified.
                    They just weren't mentioned in this file. Check whether your Tally export
                    filter excluded them, or if they're genuinely discontinued.
                  </p>
                </div>
              </div>
            )}

            {diff.unmatchedItems.length === 0 && existingMaster.length > 0 && (
              <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                Every existing Item Master entry is covered by this file — nothing left behind.
              </div>
            )}

            {existingMaster.length === 0 && (
              <div className="text-[12px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                Item Master is currently empty — all {diff.newItems.length} items will be created fresh.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={onProceed}
            disabled={loading || importing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {importing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>
            ) : (
              <>Proceed with Import<ArrowRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};