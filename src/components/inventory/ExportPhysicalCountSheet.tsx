// src/components/inventory/ExportPhysicalCountSheet.tsx
//
// Downloads the current closing stock as a CSV matching exactly what
// InventoryTable shows on screen, with an editable Physical Quantity
// column. Someone fills it in offline (Excel, Google Sheets, on a
// warehouse floor tablet) and re-uploads it through the existing
// "Physical Qty Sheet" card in FileUploader — no new upload code needed,
// this only produces a file that round-trips through processPhysicalQtyData
// in csvUtils.ts, which expects: sku, physicalquantity (case-insensitive,
// a few header aliases accepted).

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { toast } from "sonner";

// Same formula phyValue uses in InventoryTable, so the exported "Phy Value"
// column (when shown) matches the UI exactly.
function parsePrice(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Fix 2.6 pattern reused here too — any cell starting with = + - @ gets a
// leading apostrophe so Excel/Sheets never executes it as a formula.
function csvSafe(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const first = s.charAt(0);
  return first === "=" || first === "+" || first === "-" || first === "@"
    ? "'" + s
    : s;
}

function toCsvCell(value: unknown): string {
  const safe = csvSafe(value);
  return safe.includes(",") || safe.includes('"') || safe.includes("\n")
    ? '"' + safe.replace(/"/g, '""') + '"'
    : safe;
}

interface ExportPhysicalCountSheetProps {
  /** Optional: restrict the export to a specific location, matching the
   *  table's current filter. Omit to export everything in the assignment. */
  locationFilter?: string;
  className?: string;
}

export const ExportPhysicalCountSheet = ({
  locationFilter,
  className,
}: ExportPhysicalCountSheetProps) => {
  const { itemMaster, auditedItems, assignments } = useInventory();
  const { selectedAssignmentId } = useCompany();
  const { isAuditor } = useUserAccess();

  const currentAssignment = assignments.find(
    (a) => String(a.id) === String(selectedAssignmentId)
  );
  // Same visibility rule InventoryTable uses — a blind-count auditor
  // shouldn't get System Qty in the export either, or the export would
  // leak exactly what the UI is deliberately hiding from them.
  const hideSystemQuantity =
    isAuditor() && currentAssignment?.showSystemQuantity === false;

  const rows = useMemo(() => {
    let data = itemMaster
      .filter((item) => item.location !== "")
      .map((item) => {
        const audited = auditedItems.find(
          (a) => a.id === item.id && a.location === item.location
        );
        return audited || item;
      });

    if (locationFilter) {
      data = data.filter((item) => item.location === locationFilter);
    }

    return data;
  }, [itemMaster, auditedItems, locationFilter]);

  const hasPricing = rows.some(
    (item) => parsePrice(item.customAttributes?.unit_price) > 0
  );

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error("Nothing to export — no items in the current view.");
      return;
    }

    // Column order mirrors InventoryTable exactly, in the order it renders
    // them: SKU, Name, Category, [pricing columns if present], Location,
    // Sys Qty (unless hidden), Physical Quantity, Variance (unless hidden),
    // Status, Last Audited, Remarks.
    const headers = [
      "SKU",
      "Name",
      "Category",
      ...(hasPricing ? ["Unit Price", "System Value"] : []),
      "Location",
      ...(hideSystemQuantity ? [] : ["System Quantity"]),
      "Physical Quantity",   // ← the editable column
      ...(hideSystemQuantity ? [] : ["Variance"]),
      "Status",
      "Last Audited",
      "Remarks",
    ];

    const lines = [headers.map(toCsvCell).join(",")];

    rows.forEach((item) => {
      const unitPrice = parsePrice(item.customAttributes?.unit_price);
      const sysValue = item.customAttributes?.["system_value"]
        ? parsePrice(item.customAttributes["system_value"])
        : unitPrice * (item.systemQuantity ?? 0);

      const physicalQty = item.physicalQuantity ?? "";
      const variance =
        item.physicalQuantity !== null && item.physicalQuantity !== undefined
          ? item.physicalQuantity - item.systemQuantity
          : "";

      const cells = [
        item.sku,
        item.name || "",
        item.category || "",
        ...(hasPricing ? [unitPrice || "", sysValue || ""] : []),
        item.location,
        ...(hideSystemQuantity ? [] : [item.systemQuantity ?? 0]),
        physicalQty,                          // pre-filled if already counted,
                                               // blank if still pending — either
                                               // way, editable before re-upload
        ...(hideSystemQuantity ? [] : [variance]),
        item.status || "pending",
        item.lastAudited
          ? new Date(item.lastAudited).toLocaleString("en-IN")
          : "",
        item.clientRemarks || "",
      ];

      lines.push(cells.map(toCsvCell).join(","));
    });

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `physical-count-sheet-${
      locationFilter ? locationFilter.replace(/\s+/g, "-") + "-" : ""
    }${new Date().toISOString().slice(0, 10)}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${rows.length} items. Fill in "Physical Quantity" and re-upload via the Physical Qty Sheet card.`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className={className}
    >
      <Download className="h-4 w-4 mr-2 text-indigo-600" />
      Export Count Sheet
    </Button>
  );
};