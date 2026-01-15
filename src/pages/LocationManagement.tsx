import { useNavigate } from "react-router-dom"; // Import useNavigate
import { AppLayout } from "@/components/layout/AppLayout";
import { LocationMaster } from "@/components/locations/LocationMaster";
import { LocationAuditSummary } from "@/components/locations/LocationAuditSummary";
import { LocationUploadCard } from "@/components/upload/LocationUploadCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button"; // Import Button
import { ArrowLeft } from "lucide-react"; // Import ArrowLeft

const LocationManagement = () => {
  const navigate = useNavigate(); // Initialize hook

  return (
    <AppLayout showSidebar={false}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {/* ADDED BACK BUTTON */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)} 
            className="p-0 hover:bg-transparent"
          >
            <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-900" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Location Management</h1>
            <p className="text-muted-foreground">Manage inventory locations and view location-specific audit data</p>
          </div>
        </div>
        
        <Tabs defaultValue="manage" className="w-full">
           <TabsList className="mb-4 bg-gray-100">
              <TabsTrigger 
                value="manage"
                className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
              >
                Manage Locations
              </TabsTrigger>
              <TabsTrigger 
                value="import"
                className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
              >
                Import Locations
              </TabsTrigger>
           </TabsList>

           <TabsContent value="manage">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                  <LocationMaster />
                </div>
                <div>
                  <LocationAuditSummary />
                </div>
              </div>
           </TabsContent>

           <TabsContent value="import">
              <div className="max-w-2xl">
                 <LocationUploadCard />
              </div>
           </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default LocationManagement;