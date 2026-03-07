import { AppLayout } from "@/components/layout/AppLayout";
import { SearchInventory } from "@/components/search/SearchInventory";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { LocationAuditSummary } from "@/components/locations/LocationAuditSummary";
import { useCompany } from "@/context/CompanyContext";
import { useInventory } from "@/context/InventoryContext";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";

const Search = () => {
  const { selectedAssignmentId } = useCompany();
  const { assignments } = useInventory();
  
  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const selectedLocation = currentAssignment?.locationId || "";

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Inventory</h1>
          <p className="text-muted-foreground">Find and audit items manually</p>
        </div>
        
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
          {/* Left Column: Search Component */}
          <div className="lg:col-span-2 order-1">
            <SearchInventory />
          </div>
          
          {/* Right Column: Stats & Activity */}
          <div className="space-y-6 order-2">
            {selectedLocation ? (
              <>
                <LocationAuditSummary locationId={selectedLocation} hideDropdown={true} />
                <RecentActivity />
              </>
            ) : (
              <Card className="h-full flex items-center justify-center p-6 shadow-sm border-gray-200">
                <div className="text-center text-gray-400">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Please select an active assignment <br/> to view stats and activity.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Search;