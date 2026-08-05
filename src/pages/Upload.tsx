import { toastError } from "@/lib/handleError";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileUploader } from "@/components/upload/FileUploader";
import { ExampleData } from "@/components/upload/ExampleData";
import { ClearDataButton } from "@/components/upload/ClearDataButton";
import { UploadHistory } from "@/components/upload/UploadHistory";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserAccess } from "@/hooks/useUserAccess";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, UploadCloud } from "lucide-react"; 
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import { useInventory } from "@/context/InventoryContext"; // 🔥 IMPORT ADDED
import SupabaseDataService from "@/services/SupabaseDataService";
import { Button } from "@/components/ui/button"; 

const Upload = () => {
  const { currentUser } = useUser();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const { canUploadData, canUploadItemMaster, canUploadClosingStock } = useUserAccess();
  // 🔥 FETCH STATE FOR TEMPLATE RENDER VISIBILITY
  const { closingStockUploaded, assignments } = useInventory(); 
  const navigate = useNavigate();

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser && !canUploadData()) {
      navigate("/");
    }
  }, [currentUser, navigate, canUploadData]);

  const loadHistory = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      const data = await SupabaseDataService.getUploadHistory(selectedCompanyId);
      
      const filtered = data.filter(item => {
        if (item.upload_type === 'item_master') return true;
        if (item.upload_type === 'closing_stock') {
           return item.assignment_id === selectedAssignmentId;
        }
        return true; 
      });

      setHistory(filtered);
    } catch (error) {
      toastError(error, "Failed to load upload history.");
    }
  }, [selectedCompanyId, selectedAssignmentId]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadHistory();
    }
  }, [selectedCompanyId, loadHistory]);

  if (!currentUser || !canUploadData()) {
    return null; 
  }

  const isAdminCanUploadItemMaster = canUploadItemMaster();
  
  // Conditionally calculate if they are allowed to see the surplus card based on their assignment selection
  const showSurplusTemplate = canUploadClosingStock() && !!selectedAssignmentId && closingStockUploaded;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Upload Data</h1>
          <p className="text-muted-foreground">
            {isAdminCanUploadItemMaster
              ? "Import your Item Master (Company-wide) and Closing Stock (Assignment-specific)"
              : "Import Closing Stock data for your active assignment"}
          </p>
        </div>

        {currentUser.role === "auditor" && (
          <Alert className="border-indigo-200 bg-indigo-50">
            <AlertCircle className="h-5 w-5 text-indigo-600" />
            <AlertTitle className="text-indigo-800">Auditor Access</AlertTitle>
            <AlertDescription className="text-indigo-700">
              You are uploading data for your currently selected assignment.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-gray-100">
            <TabsTrigger 
              value="upload"
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
            >
              Upload Files
            </TabsTrigger>
            <TabsTrigger 
              value="examples"
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
            >
              Example Templates
            </TabsTrigger>
            {isAdminCanUploadItemMaster && (
              <TabsTrigger 
                value="clear"
                className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm"
              >
                Clear Data
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Import Inventory Data</CardTitle>
                <CardDescription>
                  {isAdminCanUploadItemMaster
                    ? "Upload Item Master (Company Wide) or Closing Stock (For Active Assignment)"
                    : "Upload Closing Stock quantities for your active assignment"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileUploader
                  userRole={currentUser.role}
                  assignedLocations={currentUser.assigned_locations || []}
                  canUploadItemMaster={isAdminCanUploadItemMaster}
                  canUploadClosingStock={canUploadClosingStock()}
                  onUploadComplete={loadHistory}
                />
              </CardContent>
            </Card>

            <Card className="p-6 border-indigo-200 bg-indigo-50 shadow-sm">
              <h3 className="text-md font-semibold text-indigo-900 mb-2">
                Important Notes:
              </h3>
              <ul className="list-disc list-inside text-sm text-indigo-800 space-y-1">
                <li>
                  <strong>Item Master:</strong> Shared across the entire company. Contains SKU, Name, Description. (No quantities).
                </li>
                <li>
                  <strong>Closing Stock:</strong> Specific to the <strong>active assignment</strong>. Contains SKU and System Quantity.
                </li>
                <li>
                  Ensure Closing Stock SKUs match the Item Master exactly.
                </li>
                <li>
                   Uploading Closing Stock overwrites any previous system quantities for this assignment's location.
                </li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="examples">
            {/* 🔥 Passed the calculated prop down so templates mirror actual availability */}
            <ExampleData showSurplusTemplate={showSurplusTemplate} />
          </TabsContent>

          {isAdminCanUploadItemMaster && (
            <TabsContent value="clear" className="space-y-4">
              <UploadHistory history={history} onDelete={loadHistory} />
              <Card className="border-red-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-red-600">
                    Clear Company Data
                  </CardTitle>
                  <CardDescription>
                    This will reset all your inventory data. This action cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ClearDataButton />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Upload;