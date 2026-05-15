import { useState, useMemo, useEffect } from "react";
import { useInventory } from "@/context/InventoryContext";
import { toast } from "sonner";
import { FileInputCard } from "./FileInputCard";
import { NoPermissionCard } from "./NoPermissionCard";
import {
  processCSV,
  processItemMasterData,
  processClosingStockData,
  processPhysicalQtyData
} from "./utils/csvUtils";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, MapPin, Lock, CheckCircle2, PackagePlus, FileSpreadsheet } from "lucide-react"; 
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
  const [surplusFile, setSurplusFile] = useState<File | null>(null);
  const [physicalQtyFile, setPhysicalQtyFile] = useState<File | null>(null); 

  const { setItemMaster, setClosingStock, addBulkSurplusItems, uploadPhysicalQuantityStock, locations, itemMaster, assignments, closingStockUploaded, refreshData } = useInventory();
  const { selectedCompanyId, selectedAssignmentId: contextAssignmentId } = useCompany();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    contextAssignmentId ? String(contextAssignmentId) : ""
  );

  const [localAssignmentUploaded, setLocalAssignmentUploaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (contextAssignmentId) {
      setSelectedAssignmentId(String(contextAssignmentId));
    }
  }, [contextAssignmentId]);

  useEffect(() => {
    const checkStatus = async () => {
      if (selectedAssignmentId) {
        const id = parseInt(selectedAssignmentId);
        if (!isNaN(id)) {
          if (contextAssignmentId && String(contextAssignmentId) === String(selectedAssignmentId)) {
             setLocalAssignmentUploaded(closingStockUploaded);
          } else {
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

  const currentActiveAssignment = useMemo(() => {
     return activeAssignments.find(a => String(a.id) === selectedAssignmentId);
  }, [activeAssignments, selectedAssignmentId]);

  const targetLocationId = currentActiveAssignment ? currentActiveAssignment.locationId : null;
  const isAssignmentActive = !!currentActiveAssignment;
  
  const isStockUploadedForCurrentSelection = localAssignmentUploaded;

  const handleFileChange = (file: File | null, setFile: (f: File | null) => void) => {
    if (file && !file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }
    setFile(file);
  };

  const handleImport = async (type: 'master' | 'stock' | 'surplus' | 'physical') => {
    if (!selectedCompanyId) {
      toast.error("No company selected");
      return;
    }

    const fileMap = { 'master': itemMasterFile, 'stock': closingStockFile, 'surplus': surplusFile, 'physical': physicalQtyFile };
    const file = fileMap[type];
    
    if (!file) {
      toast.error(`Please select a file to upload.`);
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      
      try {
        const rawRows = processCSV(text);
        if (rawRows.length === 0) {
          throw new Error("CSV file is empty or invalid");
        }

        const batchKey = generateBatchKey();

        // 1. IMPORT ITEM MASTER
        if (type === 'master') {
          const processedItems = processItemMasterData(rawRows);
          
          const trimmedItems = processedItems.map((item, index) => {
            if (!item.sku || !item.sku.trim()) throw new Error(`Row ${index + 2}: SKU is required`);
            if (!item.name || !item.name.trim()) throw new Error(`Row ${index + 2}: Name is required`);
            
            return {
              ...item,
              sku: item.sku.trim(),
              name: item.name.trim(),
              category: item.category?.trim() || 'General',
              location: item.location?.trim() || '',
              uploadBatchKey: batchKey
            };
          });
          
          await SupabaseDataService.setItemMaster(trimmedItems, selectedCompanyId);
          
          await SupabaseDataService.logUploadBatch({
            batchKey,
            companyId: selectedCompanyId,
            locationId: null,
            locationName: "Master Data",
            uploadType: "item_master",
            totalItems: trimmedItems.length
          });

          await refreshData(); 
          toast.success(`Item Master imported successfully! (${trimmedItems.length} items)`);
          setItemMasterFile(null);
        
        // 2. IMPORT BULK SURPLUS / NEW ITEMS 
        } else if (type === 'surplus') {
          if (!selectedAssignmentId) throw new Error("Please select an assignment first");

          const processedSurplus = rawRows.map((row, index) => {
            const getCol = (keys: string[]) => {
               const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
               return foundKey ? row[foundKey] : undefined;
            };

            const sku = String(getCol(['sku', 'item code', 'barcode']) || '').trim();
            const name = String(getCol(['name', 'item name', 'description']) || '').trim();
            const category = String(getCol(['category', 'group', 'type']) || 'Other').trim();
            const qtyStr = String(getCol(['physical quantity', 'qty', 'quantity', 'found']) || '1');
            const physicalQuantity = parseFloat(qtyStr) || 1;
            
            const subLocation = String(getCol(['sub-location', 'sub location', 'sublocation', 'location', 'box', 'rack']) || 'General').trim();

            if (!sku || !name) throw new Error(`Row ${index + 2}: SKU and Name are required for new items`);

            const customAttributes = { ...row };
            Object.keys(row).forEach(k => {
               const lowerK = k.toLowerCase().trim();
               if (['sku', 'item code', 'barcode', 'name', 'item name', 'description', 'category', 'group', 'type', 'physical quantity', 'qty', 'quantity', 'found', 'sub-location', 'sub location', 'sublocation', 'location', 'box', 'rack'].includes(lowerK)) {
                  delete customAttributes[k];
               }
            });

            return { sku, name, category, physicalQuantity, subLocation, customAttributes };
          });

          // 🔥 FIX: Passed batchKey here so it binds to the history item for easy targeted deletion
          await addBulkSurplusItems(processedSurplus, batchKey);

          await SupabaseDataService.logUploadBatch({
            batchKey,
            companyId: selectedCompanyId,
            locationId: targetLocationId,
            locationName: locations.find(l => l.id === targetLocationId)?.name || "Unknown",
            uploadType: "bulk_surplus",
            totalItems: processedSurplus.length,
            assignmentId: parseInt(selectedAssignmentId)
          });

          toast.success(`Successfully uploaded ${processedSurplus.length} bulk new items!`);
          setSurplusFile(null);
          await refreshData();

        // 3. IMPORT PHYSICAL QUANTITY SHEET
        } else if (type === 'physical') {
          if (!selectedAssignmentId) throw new Error("Please select an assignment first");

          const processedPhysical = processPhysicalQtyData(rawRows);
          
          await uploadPhysicalQuantityStock(processedPhysical, batchKey);

          await SupabaseDataService.logUploadBatch({
             batchKey,
             companyId: selectedCompanyId,
             locationId: targetLocationId,
             locationName: locations.find(l => l.id === targetLocationId)?.name || "Unknown",
             uploadType: "physical_quantity", 
             totalItems: processedPhysical.length,
             assignmentId: parseInt(selectedAssignmentId)
          });

          toast.success(`Physical Quantities updated successfully for ${processedPhysical.length} items!`);
          setPhysicalQtyFile(null);
          await refreshData();

        // 4. IMPORT CLOSING STOCK
        } else {
          if (!selectedAssignmentId) throw new Error("Please select an assignment first");
          
          const processedStock = processClosingStockData(
            rawRows, 
            userRole as any, 
            targetLocationId, 
            locations
          );

          toast.info("Fetching Item Master for validation...");
          const masterItems = await SupabaseDataService.getItemMaster(selectedCompanyId);
          const masterMap = new Map(masterItems.map(item => [item.sku.trim(), item]));
          const missingSkus: string[] = [];
          
          const enrichedStock = processedStock.map((item, index) => {
            const trimmedSku = item.sku?.trim() || '';
            if (!trimmedSku) throw new Error(`Row ${index + 2}: SKU is empty`);

            const masterInfo = masterMap.get(trimmedSku);
            if (!masterInfo) missingSkus.push(trimmedSku);

            return {
              sku: trimmedSku,
              name: masterInfo?.name || item.name || "Unnamed Item",
              category: masterInfo?.category || item.category || "General",
              location: item.location?.trim() || '',
              systemQuantity: item.systemQuantity || 0,
              customAttributes: {
                ...(masterInfo?.customAttributes || {}),
                ...(item.customAttributes || {})
              },
              uploadBatchKey: batchKey
            };
          });

          if (missingSkus.length > 0) {
            const uniqueMissing = [...new Set(missingSkus)];
            const exampleSkus = uniqueMissing.slice(0, 5).join('", "');
            const remaining = uniqueMissing.length > 5 ? ` (+${uniqueMissing.length - 5} more)` : '';
            
            throw new Error(
              `Validation Failed: ${uniqueMissing.length} SKUs not found in Item Master.\n` +
              `Examples: "${exampleSkus}"${remaining}.\n\n` +
              `Please upload these items to Item Master first.`
            );
          }

          await SupabaseDataService.setClosingStock(
            enrichedStock, 
            selectedCompanyId, 
            selectedAssignmentId
          );
          
          await SupabaseDataService.logUploadBatch({
            batchKey,
            companyId: selectedCompanyId,
            locationId: targetLocationId,
            locationName: locations.find(l => l.id === targetLocationId)?.name || "Unknown",
            uploadType: "closing_stock",
            totalItems: enrichedStock.length,
            assignmentId: parseInt(selectedAssignmentId)
          });

          await refreshData();
          toast.success(`Closing Stock imported! (${enrichedStock.length} items enriched with Master Data)`);
          setClosingStockFile(null);
        }

        if (onUploadComplete) onUploadComplete();

      } catch (error: any) {
        console.error("Import error:", error);
        toast.error("Import Failed", { description: error.message, duration: 6000 });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  if (!selectedCompanyId) {
      return (
          <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
             <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
             <p className="text-gray-500">Please select a company to upload data.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      
      {(userRole === 'admin' || userRole === 'super_admin') && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
           <Label>Select Assignment for Action</Label>
           <Select value={selectedAssignmentId} onValueChange={(val) => setSelectedAssignmentId(val)}>
             <SelectTrigger><SelectValue placeholder="Choose active assignment..." /></SelectTrigger>
             <SelectContent>
                {activeAssignments.length === 0 ? (
                    <SelectItem value="none" disabled>No active assignments</SelectItem>
                ) : (
                    activeAssignments.map(a => {
                        const locName = locations.find(l => l.id === a.locationId)?.name || "Unknown Loc";
                        return (
                            <SelectItem key={a.id} value={String(a.id)}>
                                {locName} - Due: {format(new Date(a.scheduledDate), 'MMM dd')}
                            </SelectItem>
                        );
                    })
                )}
             </SelectContent>
           </Select>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
        
        {canUploadItemMaster ? (
          <FileInputCard
            title="Item Master"
            description="Upload base inventory catalog (SKU, Name, Category)"
            file={itemMasterFile}
            onFileChange={(f) => handleFileChange(f, setItemMasterFile)}
            onUpload={() => handleImport('master')}
            accept=".csv"
            isUploading={isProcessing}
            icon={<Lock className="h-5 w-5 text-indigo-600" />} 
          />
        ) : (
          <NoPermissionCard title="Item Master" description="You do not have permission to upload master data." />
        )}

        {canUploadClosingStock ? (
          <div className="relative">
              <FileInputCard
                title="Closing Stock"
                description={isAssignmentActive 
                    ? `Upload stock for ${locations.find(l => l.id === targetLocationId)?.name || 'selected location'}`
                    : "Select an assignment to upload stock"
                }
                file={closingStockFile}
                onFileChange={(f) => handleFileChange(f, setClosingStockFile)}
                onUpload={() => handleImport('stock')}
                accept=".csv"
                isUploading={isProcessing}
                disabled={!isAssignmentActive || isStockUploadedForCurrentSelection}
                icon={isStockUploadedForCurrentSelection 
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" /> 
                    : <MapPin className="h-5 w-5 text-indigo-600" />
                }
              />
              
              {isStockUploadedForCurrentSelection && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Closing stock already uploaded for this assignment.
                  </div>
              )}
          </div>
        ) : (
          <NoPermissionCard title="Closing Stock" description="You do not have permission to upload closing stock." />
        )}

        {canUploadClosingStock && isAssignmentActive && isStockUploadedForCurrentSelection && (
          <FileInputCard
            title="Bulk New Items"
            description={`Add missing surplus items directly into ${locations.find(l => l.id === targetLocationId)?.name || 'selected assignment'}`}
            file={surplusFile}
            onFileChange={(f) => handleFileChange(f, setSurplusFile)}
            onUpload={() => handleImport('surplus')}
            accept=".csv"
            isUploading={isProcessing}
            icon={<PackagePlus className="h-5 w-5 text-indigo-600" />} 
          />
        )}

        {canUploadClosingStock && isAssignmentActive && isStockUploadedForCurrentSelection && (
          <FileInputCard
            title="Physical Qty Sheet"
            description="Upload reconciled quantities. Will merge with existing live audit data safely."
            file={physicalQtyFile}
            onFileChange={(f) => handleFileChange(f, setPhysicalQtyFile)}
            onUpload={() => handleImport('physical')}
            accept=".csv"
            isUploading={isProcessing}
            icon={<FileSpreadsheet className="h-5 w-5 text-indigo-600" />} 
          />
        )}

      </div>

      {isProcessing && (
        <Alert className="bg-blue-50 border-blue-200">
           <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
           <AlertDescription className="text-blue-700 ml-2">
              Processing and validating data... This may take a moment for large files.
           </AlertDescription>
        </Alert>
      )}
    </div>
  );
};