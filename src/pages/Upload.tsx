import { AppLayout } from "@/components/layout/AppLayout";
import { FileUploader } from "@/components/upload/FileUploader";
import { ExampleData } from "@/components/upload/ExampleData";
import { ClearDataButton } from "@/components/upload/ClearDataButton";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { LocationUploadCard } from "@/components/upload/LocationUploadCard"; 

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
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useUser } from "@/context/UserContext";

const Upload = () => {
  const { currentUser } = useUser();
  const { canUploadData, canUploadItemMaster, canUploadClosingStock } =
    useUserAccess();
  const navigate = useNavigate();

  
  useEffect(() => {
    if (currentUser && !canUploadData()) {
      navigate("/");
    }
  }, [currentUser, navigate, canUploadData]);

  if (!currentUser || !canUploadData()) {
    return null; 
  }

  const isAdminCanUploadItemMaster = canUploadItemMaster();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Upload Data</h1>
          <p className="text-muted-foreground">
            {isAdminCanUploadItemMaster
              ? "Import your Item Master, Closing Stock data, and optionally Locations"
              : "Import your Closing Stock data for your assigned locations"}
          </p>
        </div>

        {currentUser.role === "auditor" && (
          <Alert className="border-indigo-200 bg-indigo-50">
            <AlertCircle className="h-5 w-5 text-indigo-600" />
            <AlertTitle className="text-indigo-800">Auditor Access</AlertTitle>
            <AlertDescription className="text-indigo-700">
              As an auditor, you can only upload Closing Stock data for your
              assigned locations.
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
                    ? "Upload your Item Master (without quantity) and Closing Stock (with quantity) files"
                    : "Upload your Closing Stock (with quantity) files for your assigned locations"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploader
                  userRole={currentUser.role}
                  assignedLocations={currentUser.assigned_locations || []}
                  canUploadItemMaster={isAdminCanUploadItemMaster}
                  canUploadClosingStock={canUploadClosingStock()}
                />
              </CardContent>
            </Card>


            {isAdminCanUploadItemMaster && (
              <Card className="shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="text-gray-900">Upload Locations (Optional)</CardTitle>
                  <CardDescription>
                    Upload a CSV / Excel file with columns like{" "}
                    <span className="font-medium text-gray-700">name, status, description</span>{" "}
                    to create or update locations. You can still add locations
                    manually from the Locations page.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LocationUploadCard />
                </CardContent>
              </Card>
            )}

            <Card className="p-6 border-indigo-200 bg-indigo-50 shadow-sm">
              <h3 className="text-md font-semibold text-indigo-900 mb-2">
                Important Notes:
              </h3>
              <ul className="list-disc list-inside text-sm text-indigo-800 space-y-1">
                <li>
                  Item Master should contain product information WITHOUT
                  quantities
                </li>
                <li>
                  Closing Stock should contain the quantities for each location
                </li>
                <li>
                  The same item can appear in multiple locations with different
                  quantities
                </li>
                <li>
                  Ensure both files use the same item IDs and SKUs for proper
                  matching
                </li>
              </ul>
            </Card>
          </TabsContent>

          
          <TabsContent value="examples">
            <ExampleData />
          </TabsContent>

          
          {isAdminCanUploadItemMaster && (
            <TabsContent value="clear" className="space-y-4">
              
              <UploadHistory />

              <Card className="border-red-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-red-600">
                    Clear Company Data
                  </CardTitle>
                  <CardDescription>
                    This will reset all your inventory data. This action cannot
                    be undone.
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