import { AppLayout } from "@/components/layout/AppLayout";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";

// Loaded only when the auditor asks for it. Keeping a 15k-row table mounted
// under the camera re-rendered it on every scan and delayed the scan popup.
const InventoryTable = lazy(() =>
  import("@/components/inventory/InventoryTable").then((m) => ({ default: m.InventoryTable }))
);

const Scanner = () => {
  const [showTable, setShowTable] = useState(false);
  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Compact header on mobile — the scanner itself is what matters,
            not a large title eating screen real estate an auditor needs
            for the camera viewport. */}
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-space-900">Scanner</h1>
          <p className="text-[13px] md:text-base text-space-500 hidden sm:block">
            Scan items to record physical inventory
          </p>
        </div>

        <BarcodeScanner />

        <div>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-[13px] md:text-lg font-bold md:font-medium text-space-700 uppercase md:normal-case tracking-wide md:tracking-normal">
              Current Inventory Status
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)}>
              {showTable ? "Hide list" : "Show list"}
            </Button>
          </div>
          {showTable && (
            <Suspense fallback={<div className="py-6 text-center text-sm text-gray-400">Loading…</div>}>
              <InventoryTable />
            </Suspense>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Scanner;