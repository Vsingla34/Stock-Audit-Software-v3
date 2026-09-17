import { AppLayout } from "@/components/layout/AppLayout";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { InventoryTable } from "@/components/inventory/InventoryTable";

const Scanner = () => {
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
          <h2 className="text-[13px] md:text-lg font-bold md:font-medium mb-3 md:mb-4 text-space-700 uppercase md:normal-case tracking-wide md:tracking-normal">
            Current Inventory Status
          </h2>
          <InventoryTable />
        </div>
      </div>
    </AppLayout>
  );
};

export default Scanner;