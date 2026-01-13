import { AppLayout } from "@/components/layout/AppLayout";
import { LocationMaster } from "@/components/locations/LocationMaster";
import { LocationAuditSummary } from "@/components/locations/LocationAuditSummary";
import { LocationUploadCard } from "@/components/upload/LocationUploadCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LocationManagement = () => {
  return (
    <AppLayout showSidebar={false}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Location Management</h1>
          <p className="text-muted-foreground">Manage inventory locations and view location-specific audit data</p>
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