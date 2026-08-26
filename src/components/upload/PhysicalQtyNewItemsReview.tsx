// src/components/upload/PhysicalQtyNewItemsReview.tsx
//
// Shown when a re-uploaded Physical Qty Sheet contains SKUs that don't
// exist yet in this assignment's closing stock — instead of hard-rejecting
// the whole upload (the old behaviour), this lists exactly what's new and
// lets the admin decide whether to create them before anything is written.

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PackagePlus, AlertTriangle, Loader2 } from "lucide-react";
import type { PhysicalQtyRow } from "./utils/csvUtils";

interface PhysicalQtyNewItemsReviewProps {
  open: boolean;
  newItems: PhysicalQtyRow[];
  matchedCount: number;
  importing: boolean;
  onCancel: () => void;
  onConfirmCreate: () => void;   // create the new items, then continue
  onSkipNew: () => void;          // ignore new items, only apply the matched ones
}

export const PhysicalQtyNewItemsReview = ({
  open, newItems, matchedCount, importing, onCancel, onConfirmCreate, onSkipNew,
}: PhysicalQtyNewItemsReviewProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !importing && onCancel()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-emerald-600" />
            New Items Found
          </DialogTitle>
          <DialogDescription>
            {newItems.length} SKU{newItems.length !== 1 ? "s" : ""} in this sheet
            {newItems.length !== 1 ? " aren't" : " isn't"} in this assignment's closing stock yet.
            Do you want to add {newItems.length !== 1 ? "them" : "it"}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="max-h-52 overflow-y-auto rounded-lg border border-emerald-200 bg-emerald-50/50">
            {newItems.map((item) => (
              <div
                key={item.sku}
                className="flex items-center justify-between px-3 py-2 border-b border-emerald-100 last:border-0 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="text-gray-800 font-medium truncate">
                    {item.name || <span className="text-gray-400 italic">No name in sheet</span>}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {item.sku}
                    {item.category && <> · {item.category}</>}
                    {item.location && <> · {item.location}</>}
                  </p>
                </div>
                <span className="text-gray-600 font-mono text-[12px] shrink-0 ml-3">
                  qty: {item.physicalQuantity}
                </span>
              </div>
            ))}
          </div>

          {matchedCount > 0 && (
            <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {matchedCount} other item{matchedCount !== 1 ? "s" : ""} in the sheet already{" "}
              {matchedCount !== 1 ? "exist" : "exists"} and will be updated either way.
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} disabled={importing} className="sm:mr-auto">
            Cancel Upload
          </Button>
          <Button
            variant="outline"
            onClick={onSkipNew}
            disabled={importing}
          >
            Skip New, Update Rest
          </Button>
          <Button
            onClick={onConfirmCreate}
            disabled={importing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {importing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</>
            ) : (
              `Add ${newItems.length} New & Continue`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};