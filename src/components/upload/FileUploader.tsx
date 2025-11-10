// src/components/upload/FileUploader.tsx
import { useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { toast } from "sonner";
import { FileInputCard } from "./FileInputCard";
import { LocationSelector } from "./LocationSelector";
import { ImportSection } from "./ImportSection";
import { NoPermissionCard } from "./NoPermissionCard";
import {
  processCSV,
  processItemMasterData,
  processClosingStockData,
} from "./utils/csvUtils";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCompany } from "@/context/CompanyContext";
import SupabaseDataService from "@/services/supabaseDataService";

export interface FileUploaderProps {
  userRole: "admin" | "auditor" | "client";
  assignedLocations?: string[];
  canUploadItemMaster?: boolean;
  canUploadClosingStock?: boolean;
}

/**
 * ✅ Generate a REAL UUID v4 string so Postgres uuid columns accept it.
 */
const generateBatchKey = (): string => {
  // Modern browsers / Node 18+
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 polyfill
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const FileUploader = ({
  userRole,
  assignedLocations = [],
  canUploadItemMaster = false,
  canUploadClosingStock = false,
}: FileUploaderProps) => {
  const [itemMasterFile, setItemMasterFile] = useState<File | null>(null);
  const [closingStockFile, setClosingStockFile] = useState<File | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("default");
  const [isImporting, setIsImporting] = useState(false);

  const { setItemMaster, setClosingStock, locations, itemMaster } =
    useInventory();
  const { selectedCompanyId } = useCompany();

  const accessibleLocations = locations.filter(
    (location) =>
      userRole === "admin" ||
      (assignedLocations && assignedLocations.includes(location.id))
  );

  const hasItemMaster = itemMaster.length > 0;

  const handleItemMasterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Invalid file format", {
          description: "Please upload a CSV file",
        });
        e.target.value = "";
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please upload a file smaller than 10MB",
        });
        e.target.value = "";
        return;
      }

      setItemMasterFile(file);
      toast.info("File selected", {
        description: `${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
      });
    }
  };

  const handleClosingStockUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!hasItemMaster) {
        toast.error("Item Master Required", {
          description:
            "Please upload the Item Master file first before uploading Closing Stock.",
        });
        e.target.value = "";
        return;
      }

      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Invalid file format", {
          description: "Please upload a CSV file",
        });
        e.target.value = "";
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please upload a file smaller than 10MB",
        });
        e.target.value = "";
        return;
      }

      setClosingStockFile(file);
      toast.info("File selected", {
        description: `${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
      });
    }
  };

  const handleImport = async () => {
    setIsImporting(true);

    try {
      // ---------- ITEM MASTER UPLOAD ----------
      if (canUploadItemMaster && itemMasterFile) {
        if (!selectedCompanyId) {
          throw new Error(
            "Please select a company before uploading the Item Master."
          );
        }

        const text = await itemMasterFile.text();
        const rows = processCSV(text);

        if (rows.length === 0) {
          throw new Error("Item Master file is empty or invalid.");
        }

        const firstRow = rows[0];
        const requiredColumns = ["sku", "name"];
        const missingColumns = requiredColumns.filter(
          (col) => !(col in firstRow)
        );

        if (missingColumns.length > 0) {
          throw new Error(
            `Missing required columns in Item Master: ${missingColumns.join(
              ", "
            )}. Required columns are: SKU, Name, Category (optional)`
          );
        }

        const processedItems = processItemMasterData(rows);

        if (processedItems.length === 0) {
          throw new Error("No valid items found in Item Master file");
        }

        const batchKey = generateBatchKey();
        const itemsWithKey = processedItems.map((item) => ({
          ...item,
          uploadBatchKey: batchKey,
        }));

        await setItemMaster(itemsWithKey, selectedCompanyId);

        await SupabaseDataService.logUploadBatch({
          batchKey,
          companyId: selectedCompanyId,
          locationId: null,
          locationName: null,
          uploadType: "item_master",
          totalItems: itemsWithKey.length,
        });

        toast.success("Item Master Uploaded Successfully!", {
          description: `Loaded ${itemsWithKey.length} products. You can now upload Closing Stock.`,
        });

        setItemMasterFile(null);
      }

      // ---------- CLOSING STOCK UPLOAD ----------
      else if (canUploadClosingStock && closingStockFile) {
        if (!selectedCompanyId) {
          throw new Error(
            "Please select a company before uploading Closing Stock."
          );
        }

        if (!hasItemMaster) {
          throw new Error(
            "Item Master must be uploaded first. Please contact your administrator to upload the Item Master."
          );
        }

        if (
          userRole === "auditor" &&
          (!selectedLocation || selectedLocation === "default")
        ) {
          throw new Error(
            "Please select a location before uploading closing stock."
          );
        }

        const text = await closingStockFile.text();
        const rows = processCSV(text);

        if (rows.length === 0) {
          throw new Error("Closing Stock file is empty or invalid.");
        }

        const firstRow = rows[0];
        const requiredColumns = ["sku", "systemquantity"];
        const missingColumns = requiredColumns.filter((col) => {
          const lowerCaseKeys = Object.keys(firstRow).map((k) =>
            k.toLowerCase()
          );
          return !lowerCaseKeys.includes(col);
        });

        if (missingColumns.length > 0) {
          throw new Error(
            `Missing required columns in Closing Stock: ${missingColumns.join(
              ", "
            )}. Required columns are: SKU, SystemQuantity, Location (for admin)`
          );
        }

        const processedItems = processClosingStockData(
          rows,
          userRole,
          selectedLocation,
          locations
        );

        if (processedItems.length === 0) {
          throw new Error("No valid items found in Closing Stock file");
        }

        const uploadSKUs = processedItems.map((item) => item.sku);
        const masterSKUs = new Set(itemMaster.map((item) => item.sku));
        const invalidSKUs = uploadSKUs.filter((sku) => !masterSKUs.has(sku));

        if (invalidSKUs.length > 0) {
          const uniqueInvalidSKUs = [...new Set(invalidSKUs)];
          throw new Error(
            `The following SKUs are not in the Item Master and cannot be uploaded: ${uniqueInvalidSKUs
              .slice(0, 10)
              .join(", ")}${
              uniqueInvalidSKUs.length > 10
                ? ` and ${uniqueInvalidSKUs.length - 10} more...`
                : ""
            }. Only items from the Item Master can be included in Closing Stock.`
          );
        }

        const batchKey = generateBatchKey();
        const itemsWithKey = processedItems.map((item) => ({
          ...item,
          uploadBatchKey: batchKey,
        }));

        await setClosingStock(itemsWithKey, selectedCompanyId);

        let locationIdForHistory: string | null = null;
        let locationNameForHistory: string | null = null;

        if (
          userRole === "auditor" &&
          selectedLocation &&
          selectedLocation !== "default"
        ) {
          locationIdForHistory = selectedLocation;
          const locObj = locations.find((l) => l.id === selectedLocation);
          locationNameForHistory = locObj?.name ?? null;
        }

        await SupabaseDataService.logUploadBatch({
          batchKey,
          companyId: selectedCompanyId,
          locationId: locationIdForHistory,
          locationName: locationNameForHistory,
          uploadType: "closing_stock",
          totalItems: itemsWithKey.length,
        });

        toast.success("Closing Stock Uploaded Successfully!", {
          description: `Successfully saved ${itemsWithKey.length} items to the database.`,
        });

        setClosingStockFile(null);
      }
    } catch (error: any) {
      console.error("Import error:", error);

      let errorTitle = "Import Failed";
      let errorDescription = error.message || "An unexpected error occurred.";

      if (error.message && error.message.includes("VALIDATION_ERROR:")) {
        errorTitle = "Validation Error";
        errorDescription = error.message.replace("VALIDATION_ERROR:", "").trim();
      }

      toast.error(errorTitle, {
        description: errorDescription,
        duration: 8000,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const isImportDisabled =
    isImporting || (!itemMasterFile && !closingStockFile);

  if (!canUploadItemMaster && !canUploadClosingStock) {
    return <NoPermissionCard />;
  }

  return (
    <div className="space-y-6">
      {!hasItemMaster && canUploadClosingStock && !canUploadItemMaster && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Item Master Required:</strong> The Item Master has not been
            uploaded yet. Please contact your administrator to upload the Item
            Master before you can upload Closing Stock.
          </AlertDescription>
        </Alert>
      )}

      {hasItemMaster && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Item Master Loaded:</strong>{" "}
            {
              itemMaster.filter(
                (i) => !i.location || i.location === ""
              ).length
            }{" "}
            unique products in the system. You can now upload Closing Stock for
            specific locations.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {canUploadItemMaster && (
          <FileInputCard
            title="Step 1: Upload Item Master"
            description="Upload a CSV with SKU, Name, and Category."
            fileInputId="itemMasterUpload"
            file={itemMasterFile}
            onFileChange={handleItemMasterUpload}
          />
        )}

        {canUploadClosingStock && (
          <div className={!canUploadItemMaster ? "md:col-span-2" : ""}>
            <FileInputCard
              title={
                canUploadItemMaster
                  ? "Step 2: Upload Closing Stock"
                  : "Upload Closing Stock"
              }
              description={
                userRole === "auditor"
                  ? "Upload a CSV with SKU and System Quantity for your selected location. Only items from the Item Master can be uploaded."
                  : "Upload a CSV with SKU, System Quantity, and Location. Only items from the Item Master can be uploaded."
              }
              fileInputId="closingStockUpload"
              file={closingStockFile}
              onFileChange={handleClosingStockUpload}
              disabled={!hasItemMaster}
            />

            {userRole === "auditor" && accessibleLocations.length > 0 && (
              <div className="mt-4">
                <LocationSelector
                  locations={accessibleLocations}
                  selectedLocation={selectedLocation}
                  onLocationChange={setSelectedLocation}
                  placeholder="Select location for upload"
                />
              </div>
            )}
          </div>
        )}

        <div className="md:col-span-2">
          <div className="flex justify-center mb-4">
            <Button
              className="w-full max-w-md"
              disabled={isImportDisabled}
              onClick={handleImport}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                </>
              ) : (
                `Process ${
                  itemMasterFile ? "Item Master File" : "Closing Stock File"
                }`
              )}
            </Button>
          </div>
          <ImportSection
            canUploadItemMaster={canUploadItemMaster}
            canUploadClosingStock={canUploadClosingStock}
            showLocationInfo={userRole === "auditor"}
          />
        </div>
      </div>
    </div>
  );
};
