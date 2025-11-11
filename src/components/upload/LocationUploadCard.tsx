// src/components/upload/LocationUploadCard.tsx
import { useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, UploadCloud, Loader2 } from "lucide-react";
import { processCSV } from "./utils/csvUtils";

export const LocationUploadCard = () => {
  const { locations, addLocation } = useInventory();
  const { selectedCompanyId } = useCompany();

  const [locationFile, setLocationFile] = useState<File | null>(null);
  const [isImportingLocations, setIsImportingLocations] = useState(false);

  // --- File selection --------------------------------------------------------
  const handleLocationFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];

    // CSV / Excel – right now we’re using CSV like your other uploads
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv")) {
      toast.error("Invalid file format", {
        description: "Please upload a CSV file for locations.",
      });
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Please upload a file smaller than 10MB.",
      });
      e.target.value = "";
      return;
    }

    setLocationFile(file);
    toast.info("Location file selected", {
      description: `${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
    });
  };

  // --- Import logic ---------------------------------------------------------
  const handleImportLocations = async () => {
    if (!locationFile) {
      toast.error("No file selected", {
        description: "Please choose a locations file first.",
      });
      return;
    }

    if (!selectedCompanyId) {
      toast.error("Company required", {
        description: "Please select a company before uploading locations.",
      });
      return;
    }

    setIsImportingLocations(true);

    try {
      const text = await locationFile.text();
      const rows = processCSV(text);

      if (rows.length === 0) {
        throw new Error("Location file is empty or invalid.");
      }

      // Existing names for duplicate detection (case-insensitive)
      const existingNames = new Set(
        locations.map((loc) => loc.name.trim().toLowerCase())
      );

      let created = 0;
      let skipped = 0;

      for (const row of rows) {
        // Try multiple possible header names (case-insensitive)
        const rawName =
          row.name ??
          row.Name ??
          row["location"] ??
          row["Location"] ??
          row["Location Name"];

        const rawStatus = row.status ?? row.Status ?? row["Status"];
        const rawDescription =
          row.description ?? row.Description ?? row["Description"];

        const name = (rawName ?? "").toString().trim();

        if (!name) {
          skipped++;
          continue;
        }

        const key = name.toLowerCase();

        // Skip duplicates (existing or already created in this import)
        if (existingNames.has(key)) {
          skipped++;
          continue;
        }

        const isActive =
          typeof rawStatus === "string"
            ? rawStatus.toLowerCase() !== "inactive"
            : true;

        await addLocation({
          name,
          description: rawDescription
            ? rawDescription.toString().trim()
            : undefined,
          active: isActive,
          companyId: selectedCompanyId,
        });

        existingNames.add(key);
        created++;
      }

      toast.success("Locations uploaded", {
        description: `Added ${created} locations. Skipped ${skipped} duplicate/invalid rows.`,
      });

      setLocationFile(null);
    } catch (error: any) {
      console.error("Location import error:", error);
      toast.error("Failed to import locations", {
        description: error?.message || "An unexpected error occurred.",
      });
    } finally {
      setIsImportingLocations(false);
    }
  };

  const isImportDisabled = isImportingLocations || !locationFile;

  return (
    <div className="space-y-4">
      {!selectedCompanyId && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select a company before importing locations. Locations will be
            created for the currently selected company.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="file"
          accept=".csv"
          onChange={handleLocationFileChange}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
        />

        <Button
          type="button"
          onClick={handleImportLocations}
          disabled={isImportDisabled || !selectedCompanyId}
          className="w-full md:w-auto"
        >
          {isImportingLocations ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" />
              Process Location File
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Expected columns:{" "}
        <span className="font-medium">name</span> (required),{" "}
        <span className="font-medium">status</span> (optional –{" "}
        <code>active</code>/<code>inactive</code>), and{" "}
        <span className="font-medium">description</span> (optional). Duplicate
        location names for the same company are skipped.
      </p>
    </div>
  );
};
