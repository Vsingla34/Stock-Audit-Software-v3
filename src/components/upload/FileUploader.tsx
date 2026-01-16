import { useState, useMemo, useEffect } from "react";
import { useInventory } from "@/context/InventoryContext";
import { toast } from "sonner";
import { FileInputCard } from "./FileInputCard";
import { NoPermissionCard } from "./NoPermissionCard";
import {
  processCSV,
  processItemMasterData,
  processClosingStockData,
} from "./utils/csvUtils";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, MapPin, Lock, CheckCircle2 } from "lucide-react"; 
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCompany } from "@/context/CompanyContext";
import SupabaseDataService from "@/services/SupabaseDataService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export interface FileUploaderProps {
  userRole: "super_admin" | "admin" | "auditor" | "client" | string;
  assignedLocations?: string[];
  canUploadItemMaster?: boolean;
  canUploadClosingStock?: boolean;
  onUploadComplete?: () => void;
}

const generateBatchKey = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "batch-" + Math.random().toString(36).substr(2, 9);
};

export const FileUploader = ({
  userRole,
  assignedLocations = [],
  canUploadItemMaster = false,
  canUploadClosingStock = false,
  onUploadComplete,
}: FileUploaderProps) => {
  const [itemMasterFile, setItemMasterFile] = useState<File | null>(null);
  const [closingStockFile, setClosingStockFile] = useState<File | null>(null);

  // FIX: Destructure closingStockUploaded and refreshData
  const { setItemMaster, setClosingStock, locations, itemMaster, assignments, closingStockUploaded, refreshData } = useInventory();
  const { selectedCompanyId, selectedAssignmentId: contextAssignmentId } = useCompany();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    contextAssignmentId ? String(contextAssignmentId) : ""
  );

  // Local state for dropdown/immediate update checks
  const [localAssignmentUploaded, setLocalAssignmentUploaded] = useState(false);

  useEffect(() => {
    if (contextAssignmentId) {
      setSelectedAssignmentId(String(contextAssignmentId));
    }
  }, [contextAssignmentId]);

  // NEW: Check upload status whenever assignment selection changes
  useEffect(() => {
    const checkStatus = async () => {
      if (selectedAssignmentId) {
        const id = parseInt(selectedAssignmentId);
        if (!isNaN(id)) {
          // If context ID matches selection, sync with global state initially
          if (contextAssignmentId && String(contextAssignmentId) === String(selectedAssignmentId)) {
             setLocalAssignmentUploaded(closingStockUploaded);
          } else {
             // Otherwise fetch explicitly
             const hasStock = await SupabaseDataService.hasClosingStockForAssignment(id);
             setLocalAssignmentUploaded(hasStock);
          }
        }
      } else {
        setLocalAssignmentUploaded(false);
      }
    };
    checkStatus();
  }, [selectedAssignmentId, closingStockUploaded, contextAssignmentId]);

  const activeAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (a.status === 'finalized') return false;
      if (userRole === 'super_admin' || userRole === 'admin') return true;
      if (userRole === 'auditor') {
         return true; 
      }
      return false;
    });
  }, [assignments, userRole, assignedLocations]);

  const hasItemMaster = itemMaster.length > 0;

  const currentActiveAssignment = useMemo(() => {
     return activeAssignments.find(a => String(a.id) === selectedAssignmentId);
  }, [activeAssignments, selectedAssignmentId]);

  const targetLocationId = currentActiveAssignment ? currentActiveAssignment.locationId : null;
  const isAssignmentActive = !!currentActiveAssignment;
  
  // Combine logic: If context ID is present, we trust the sync effect. 
  // Basically 'localAssignmentUploaded' is our source of truth now since the effect syncs it.
  const isStockUploadedForCurrentSelection = localAssignmentUploaded;

  const handleFileChange = (file: File | null, setFile: (f: File | null) => void) => {
    if (file && !file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Invalid file", { description: "Please upload a CSV file" });
      return;
    }
    setFile(file);
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);

    try {
      if (canUploadItemMaster && itemMasterFile) {
        if (!selectedCompanyId) throw new Error("Select a company first.");
        
        const text = await itemMasterFile.text();
        const rows = processCSV(text);
        if (rows.length === 0) throw new Error("File is empty.");

        const processedItems = processItemMasterData(rows);
        const batchKey = generateBatchKey();
        
        const itemsWithKey = processedItems.map((item) => ({ 
            ...item, 
            uploadBatchKey: batchKey 
        }));

        await setItemMaster(itemsWithKey, selectedCompanyId);
        
        await SupabaseDataService.logUploadBatch({
          batchKey,
          companyId: selectedCompanyId,
          locationId: null,
          locationName: "All Locations",
          uploadType: "item_master",
          totalItems: itemsWithKey.length,
        });

        toast.success("Item Master Uploaded", { description: `${itemsWithKey.length} items added.` });
        setItemMasterFile(null);
        await refreshData(); 
        if (onUploadComplete) onUploadComplete();
      }

      else if (canUploadClosingStock && closingStockFile) {
        if (!selectedCompanyId) throw new Error("Select a company first.");
        if (!hasItemMaster) throw new Error("Item Master missing. Please upload it first.");
        
        // Validation
        if (isStockUploadedForCurrentSelection) throw new Error("Closing stock already uploaded for this assignment.");

        if (!selectedAssignmentId) throw new Error("No assignment selected.");
        if (!currentActiveAssignment) throw new Error("The selected assignment is not active or valid.");
        if (!targetLocationId) throw new Error("Selected Assignment has no valid Location linked.");

        const text = await closingStockFile.text();
        const rows = processCSV(text);
        if (rows.length === 0) throw new Error("File is empty.");

        const processedItems = processClosingStockData(
          rows,
          'auditor', 
          targetLocationId, 
          locations
        );

        if (processedItems.length === 0) throw new Error("No valid items found.");

        const masterMap = new Map();
        itemMaster.forEach(item => {
            const cleanKey = String(item.sku).trim().toLowerCase();
            masterMap.set(cleanKey, item);
        });

        const invalidSKUs: string[] = [];
        const itemsWithDetails: any[] = [];
        const batchKey = generateBatchKey();

        processedItems.forEach(stockItem => {
            const stockSku = String(stockItem.sku).trim().toLowerCase();
            const masterItem = masterMap.get(stockSku);

            if (!masterItem) {
                invalidSKUs.push(stockItem.sku);
            } else {
                itemsWithDetails.push({
                    ...stockItem,
                    sku: masterItem.sku, 
                    name: masterItem.name || "Unnamed Item", 
                    category: masterItem.category || "Uncategorized",
                    description: masterItem.description || "",
                    uom: masterItem.uom,
                    price: masterItem.price,
                    uploadBatchKey: batchKey
                });
            }
        });
        
        if (invalidSKUs.length > 0) {
           const examples = invalidSKUs.slice(0, 3).join(", ");
           throw new Error(`Found ${invalidSKUs.length} SKUs not in Item Master (e.g., ${examples}). Please check for whitespace or typos. Upload rejected.`);
        }

        if (itemsWithDetails.length === 0) throw new Error("No valid items matched with Item Master.");

        await setClosingStock(itemsWithDetails, selectedCompanyId, selectedAssignmentId);

        const locName = locations.find(l => l.id === targetLocationId)?.name || "Unknown";
        const assignmentIdInt = parseInt(selectedAssignmentId, 10);
        
        await SupabaseDataService.logUploadBatch({
          batchKey,
          companyId: selectedCompanyId,
          locationId: targetLocationId,
          locationName: locName,
          uploadType: "closing_stock",
          totalItems: itemsWithDetails.length,
          assignmentId: isNaN(assignmentIdInt) ? null : assignmentIdInt
        });

        toast.success("Closing Stock Uploaded", { description: `${itemsWithDetails.length} items added for ${locName}` });
        setClosingStockFile(null);
        
        // FIX: Force immediate refresh and local state update
        await refreshData();
        setLocalAssignmentUploaded(true); 
        
        if (onUploadComplete) onUploadComplete();
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Upload Failed", { description: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  if (!canUploadItemMaster && !canUploadClosingStock) return <NoPermissionCard />;

  return (
    <div className="space-y-6">
      {!hasItemMaster && canUploadClosingStock && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Item Master Missing:</strong> You must upload the Item Master file before uploading Closing Stock.
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Alert if Closing Stock is already uploaded */}
      {canUploadClosingStock && isStockUploadedForCurrentSelection && (
         <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800">
           <CheckCircle2 className="h-4 w-4 text-yellow-600" />
           <AlertDescription>
             <strong>Already Uploaded:</strong> Closing stock data exists for this assignment. Delete it from the history tab to re-upload.
           </AlertDescription>
         </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {canUploadItemMaster && (
          <FileInputCard
            title="Step 1: Item Master"
            description="Upload CSV with SKU, Name, Category. (No quantities)"
            fileInputId="itemMasterUpload"
            file={itemMasterFile}
            onFileChange={(e) => handleFileChange(e.target.files?.[0] || null, setItemMasterFile)}
          />
        )}

        {canUploadClosingStock && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
               <Label>Target Assignment</Label>
               
               {contextAssignmentId ? (
                  <div className={`p-3 rounded-md border ${isAssignmentActive ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
                      {isAssignmentActive ? (
                        <>
                           <div className="flex items-center gap-2 text-indigo-900 font-medium">
                              <Lock className="h-4 w-4 text-indigo-500" />
                              Using Active Assignment
                           </div>
                           <div className="mt-2 text-sm text-indigo-700 flex items-center gap-2 ml-6">
                              <MapPin className="h-3 w-3" />
                              {locations.find(l => l.id === currentActiveAssignment?.locationId)?.name || "Unknown Location"}
                           </div>
                           <div className="text-xs text-indigo-500 ml-6 mt-1">
                              ID: {contextAssignmentId} • {currentActiveAssignment?.scheduledDate ? format(new Date(currentActiveAssignment.scheduledDate), "MMM dd, yyyy") : ""}
                           </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-red-700">
                           <AlertCircle className="h-4 w-4" />
                           <span>The selected assignment is not active or finalized. Upload is disabled.</span>
                        </div>
                      )}
                  </div>
               ) : (
                  <>
                    {activeAssignments.length === 0 ? (
                      <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                        No active assignments found. Please create an assignment first.
                      </p>
                    ) : (
                      <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Assignment..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeAssignments.map(a => {
                            const loc = locations.find(l => l.id === a.locationId);
                            const date = a.scheduledDate ? format(new Date(a.scheduledDate), "MMM dd") : "";
                            return (
                              <SelectItem key={a.id} value={String(a.id)}>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3 text-indigo-500" />
                                  <span className="font-medium">{loc?.name || "Unknown"}</span>
                                  <span className="text-gray-400 text-xs">({date})</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </>
               )}
            </div>

            <FileInputCard
              title="Step 2: Closing Stock"
              description="Upload CSV with SKU and System Quantity."
              fileInputId="closingStockUpload"
              file={closingStockFile}
              onFileChange={(e) => handleFileChange(e.target.files?.[0] || null, setClosingStockFile)}
              // FIX: Disable if closing stock already uploaded
              disabled={!hasItemMaster || !selectedAssignmentId || !isAssignmentActive || isStockUploadedForCurrentSelection} 
            />
          </div>
        )}

        <div className="md:col-span-2 flex flex-col items-center">
          <Button
            className="w-full max-w-md bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={isImporting || (!itemMasterFile && !closingStockFile)}
            onClick={handleImport}
          >
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Start Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
};