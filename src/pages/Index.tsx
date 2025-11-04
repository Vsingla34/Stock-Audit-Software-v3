import { AppLayout } from "@/components/layout/AppLayout";
import { InventoryOverview } from "@/components/dashboard/InventoryOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Download, Barcode, Search, ClipboardList, Upload } from "lucide-react";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useUser } from "@/context/UserContext";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { LocationFilterDropdown } from "@/components/LocationFilterDropdown";

const Index = () => {
  const { canUploadData, canPerformAudits } = useUserAccess();
  const { currentUser } = useUser();
  
  // Use the centralized location filter hook
  const { 
    selectedLocation,
    setSelectedLocation, 
    availableLocations,
    shouldShowLocationFilter 
  } = useLocationFilter();
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4"/>
            Export Report
          </Button>
        </div>

        <InventoryOverview />

        <div className="grid gap-6 md:grid-cols-2">
          {/* RecentActivity now uses the shared selectedLocation state */}
          <RecentActivity selectedLocation={selectedLocation} />
          
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Quick Actions</h2>
            <div className="grid gap-4 grid-cols-2">
              <Button asChild className="h-24 flex flex-col">
                <Link to="/scanner">
                  <Barcode className="h-6 w-6 mb-2" />
                  <div>Scan Items</div>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-24 flex flex-col">
                <Link to="/search">
                  <Search className="h-6 w-6 mb-2" />
                  <div>Search Inventory</div>
                </Link>
              </Button>
            </div>
            
            <div className="grid gap-4 grid-cols-2 mt-2">
              {canUploadData() && (
                <Button asChild variant="outline" className="h-24 flex flex-col">
                  <Link to="/upload">
                    <Upload className="h-6 w-6 mb-2" />
                    <div>Upload Data</div>
                  </Link>
                </Button>
              )}
              {canPerformAudits() && (
                <Button asChild variant="outline" className="h-24 flex flex-col">
                  <Link to="/questionnaire">
                    <ClipboardList className="h-6 w-6 mb-2" />
                    <div>Questionnaires</div>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Inventory Status</h2>
            
            {/* Use the shared LocationFilterDropdown component */}
            {shouldShowLocationFilter && (
              <LocationFilterDropdown
                selectedLocation={selectedLocation}
                onLocationChange={setSelectedLocation}
                availableLocations={availableLocations}
                showAllOption={currentUser?.role === "admin"}
              />
            )}
          </div>
          
          {/* InventoryTable also uses the same selectedLocation */}
          <InventoryTable selectedLocation={selectedLocation} />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;