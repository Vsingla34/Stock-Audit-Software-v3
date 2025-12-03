import { AppLayout } from "@/components/layout/AppLayout";
import { InventoryOverview } from "@/components/dashboard/InventoryOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Barcode, Search, ClipboardList, Upload, FileSpreadsheet } from "lucide-react";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { useUser } from "@/context/UserContext";

const Index = () => {
  const { canUploadData, canPerformAudits, isClientUser } = useUserAccess();
  const { currentUser } = useUser();

  const {
    selectedLocation,
    setSelectedLocation,
    availableLocations,
    isAdmin
  } = useLocationFilter();

  const isClient = isClientUser();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome back, <span className="text-indigo-600">{currentUser?.name}</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Dashboard
          </p>
        </div>

        <InventoryOverview 
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          availableLocations={availableLocations}
          isAdmin={isAdmin}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <RecentActivity selectedLocation={selectedLocation} />
          
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
            
            {/* Row 1: Context-sensitive actions */}
            <div className="grid gap-4 grid-cols-2">
              {isClient ? (
                // Client Actions
                <>
                  <Button asChild className="h-24 flex flex-col bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md transition-all">
                    <Link to="/reports">
                      <FileSpreadsheet className="h-6 w-6 mb-2" />
                      <div>View Reports</div>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-24 flex flex-col bg-white hover:bg-indigo-50 border-gray-200 text-gray-700 hover:text-indigo-700 shadow-sm transition-all">
                    <Link to="/questionnaire">
                      <ClipboardList className="h-6 w-6 mb-2 text-indigo-600" />
                      <div>View Questionnaires</div>
                    </Link>
                  </Button>
                </>
              ) : (
                // Admin/Auditor Actions
                <>
                  <Button asChild className="h-24 flex flex-col bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md transition-all">
                    <Link to="/scanner">
                      <Barcode className="h-6 w-6 mb-2" />
                      <div>Scan Items</div>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-24 flex flex-col bg-white hover:bg-indigo-50 border-gray-200 text-gray-700 hover:text-indigo-700 shadow-sm transition-all">
                    <Link to="/search">
                      <Search className="h-6 w-6 mb-2 text-indigo-600" />
                      <div>Search Inventory</div>
                    </Link>
                  </Button>
                </>
              )}
            </div>
            
            {/* Row 2: Additional Actions (Upload / Audit) - Hidden for clients if they don't have permissions */}
            {(canUploadData() || canPerformAudits()) && !isClient && (
              <div className="grid gap-4 grid-cols-2 mt-2">
                {canUploadData() && (
                  <Button asChild variant="outline" className="h-24 flex flex-col bg-white hover:bg-indigo-50 border-gray-200 text-gray-700 hover:text-indigo-700 shadow-sm transition-all">
                    <Link to="/upload">
                      <Upload className="h-6 w-6 mb-2 text-indigo-600" />
                      <div>Upload Data</div>
                    </Link>
                  </Button>
                )}
                {canPerformAudits() && (
                  <Button asChild variant="outline" className="h-24 flex flex-col bg-white hover:bg-indigo-50 border-gray-200 text-gray-700 hover:text-indigo-700 shadow-sm transition-all">
                    <Link to="/questionnaire">
                      <ClipboardList className="h-6 w-6 mb-2 text-indigo-600" />
                      <div>Questionnaires</div>
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Inventory Status</h2>
          </div>
          
          <InventoryTable selectedLocation={selectedLocation} />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;