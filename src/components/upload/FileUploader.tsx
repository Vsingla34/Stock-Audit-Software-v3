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

  const { setItemMaster, setClosingStock, locations, itemMaster, assignments, closingStockUploaded, refreshData } = useInventory();
  const { selectedCompanyId, selectedAssignmentId: contextAssignmentId } = useCompany();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    contextAssignmentId ? String(contextAssignmentId) : ""
  );

  const [localAssignmentUploaded, setLocalAssignmentUploaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Validating state

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

  // Use this length check only for UI feedback, NOT for validation
  const hasItemMaster = itemMaster.length > 0;

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

  const handleImport = async (type: 'master' | 'stock') => {
    if (!selectedCompanyId) {
        toast.error("No company selected");
        return;
    }

    const file = type === 'master' ? itemMasterFile : closingStockFile;
    if (!file) {
      toast.error(`Please select a ${type === 'master' ? 'Item Master' : 'Closing Stock'} CSV file`);
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

        if (type === 'master') {
          const processedItems = processItemMasterData(rawRows);
          
          await SupabaseDataService.setItemMaster(processedItems.map(i => ({
             ...i,
             uploadBatchKey: batchKey
          })), selectedCompanyId);
          
          await SupabaseDataService.logUploadBatch({
            batchKey,
            companyId: selectedCompanyId,
            locationId: null,
            locationName: "Master Data",
            uploadType: "item_master",
            totalItems: processedItems.length
          });

          await refreshData(); 
          toast.success("Item Master imported successfully!");
          setItemMasterFile(null);
        
        } else {
            // CLOSING STOCK UPLOAD
            if (!selectedAssignmentId) throw new Error("Please select an assignment first");
            
            const processedStock = processClosingStockData(
                rawRows, 
                userRole as any, 
                targetLocationId, 
                locations
            );

            // OPTIMIZATION: Fetch ALL SKUs for this company to check against (Set is fast!)
            const validSkus = await SupabaseDataService.getAllSkus(selectedCompanyId);

            const missingSkus = [];
            for (const item of processedStock) {
                if (!validSkus.has(item.sku)) {
                    missingSkus.push(item.sku);
                }
            }

            if (missingSkus.length > 0) {
                const exampleSkus = missingSkus.slice(0, 3).join(", ");
                throw new Error(`Found ${missingSkus.length} SKUs not in Item Master (e.g., ${exampleSkus}). Please check for whitespace or typos. Upload rejected.`);
            }

            await SupabaseDataService.setClosingStock(processedStock.map(i => ({
                ...i,
                uploadBatchKey: batchKey
            })), selectedCompanyId, selectedAssignmentId);
            
            await SupabaseDataService.logUploadBatch({
                batchKey,
                companyId: selectedCompanyId,
                locationId: targetLocationId,
                locationName: locations.find(l => l.id === targetLocationId)?.name || "Unknown",
                uploadType: "closing_stock",
                totalItems: processedStock.length,
                assignmentId: parseInt(selectedAssignmentId)
            });

            await refreshData();
            toast.success("Closing Stock imported successfully!");
            setClosingStockFile(null);
        }

        if (onUploadComplete) onUploadComplete();

      } catch (error: any) {
        console.error("Import error:", error);
        toast.error("Import Failed", { description: error.message });
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
      
      {/* Assignment Selection Logic - Only visible if not Auditor or handled externally */}
      {(userRole === 'admin' || userRole === 'super_admin') && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
           <Label>Select Assignment for Closing Stock</Label>
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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Item Master Upload */}
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

        {/* Closing Stock Upload */}
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
      </div>

      {isProcessing && (
        <Alert className="bg-blue-50 border-blue-200">
           <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
           <AlertDescription className="text-blue-700 ml-2">
              Processing data... This may take a moment for large files.
           </AlertDescription>
        </Alert>
      )}
    </div>
  );
};