// src/components/upload/TallyGodownMapper.tsx
// Build 02 Phase A — step 2 of Tally import.
//
// After tallyUtils.parseTallyStockSummary() runs, this shows the distinct
// godown names found in the file and lets an admin map each to a real
// `locations` row. The mapping is persisted to erp_location_map so it's
// a one-time step per company — future imports auto-apply it.

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Location } from "@/context/InventoryContext";

interface TallyGodownMapperProps {
  open: boolean;
  godowns: string[];
  companyId: string;
  locations: Location[];
  onCancel: () => void;
  onConfirm: (mapping: Record<string, string>) => void; // godown name -> location id
}

export const TallyGodownMapper = ({
  open, godowns, companyId, locations, onCancel, onConfirm,
}: TallyGodownMapperProps) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load any existing mapping for this company on open, so repeat imports
  // don't require re-mapping every godown every time.
  useEffect(() => {
    if (!open || !companyId || godowns.length === 0) return;
    setLoading(true);
    supabase
      .from("erp_location_map" as any)
      .select("external_name, location_id")
      .eq("company_id", companyId)
      .eq("source", "tally")
      .in("external_name", godowns)
      .then(({ data }) => {
        const existing: Record<string, string> = {};
        (data as any[] || []).forEach((row) => {
          if (row.location_id) existing[row.external_name] = row.location_id;
        });
        setMapping(existing);
        setLoading(false);
      });
  }, [open, companyId, godowns]);

  const allMapped = godowns.every((g) => !!mapping[g]);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Persist the mapping for next time (upsert on the unique constraint)
      const rows = godowns.map((g) => ({
        company_id: companyId,
        source: "tally",
        external_name: g,
        location_id: mapping[g],
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("erp_location_map" as any)
        .upsert(rows as any, { onConflict: "company_id,source,external_name" });
      if (error) throw error;

      onConfirm(mapping);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            Map Tally Godowns to Locations
          </DialogTitle>
          <DialogDescription>
            Tally godown names don't automatically match your app's locations.
            Map each one below — this is saved, so future imports won't ask again.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
            {godowns.map((g) => (
              <div key={g} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{g}</p>
                  <p className="text-[11px] text-gray-400">Tally godown</p>
                </div>
                <Select
                  value={mapping[g] || ""}
                  onValueChange={(v) => setMapping((prev) => ({ ...prev, [g]: v }))}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Choose location…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mapping[g] && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              </div>
            ))}

            {!allMapped && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-md text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Every godown needs a location before continuing.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allMapped || saving || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            ) : (
              "Confirm & Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};