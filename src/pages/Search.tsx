import { AppLayout } from "@/components/layout/AppLayout";
import { SearchInventory } from "@/components/search/SearchInventory";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { LocationAuditSummary } from "@/components/locations/LocationAuditSummary";
import { useCompany } from "@/context/CompanyContext";
import { useInventory } from "@/context/InventoryContext";
import { MapPin, LayoutGrid } from "lucide-react";
import { Card } from "@/components/ui/card";
import { NLQueryPalette } from "@/components/search/NLQueryPalette";

const Search = () => {
  const { selectedAssignmentId, selectedCompanyId } = useCompany();
  const { assignments } = useInventory();
  
  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const selectedLocation = currentAssignment?.locationId || "";

  return (
    <AppLayout>
      <div className="space-y-8 pb-16 w-full max-w-full overflow-x-hidden min-h-screen bg-slate-50/50">
        
        {/* Premium Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2.5 bg-white border border-slate-200 shadow-sm rounded-xl">
                <LayoutGrid className="h-6 w-6 text-blue-600" />
              </div>
              Search Inventory
            </h1>
            <p className="text-[14px] font-medium text-slate-500 mt-3 pl-1">
              Find, audit, and reconcile items manually in real-time.
            </p>
          </div>
          <NLQueryPalette companyId={selectedCompanyId} assignmentId={selectedAssignmentId} />
        </div>
        
        <div className="flex flex-col xl:grid xl:grid-cols-3 gap-8 relative">
          
          {/* Left Column: Search Component */}
          <div className="xl:col-span-2 order-1">
            <SearchInventory />
          </div>
          
          {/* Right Column: Sticky Stats & Activity */}
          <div className="space-y-6 order-2 xl:sticky xl:top-6 h-fit">
            {selectedLocation ? (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <LocationAuditSummary locationId={selectedLocation} hideDropdown={true} />
                </div>
                {/* Strict height forces the internal scrollbar to appear */}
                <div className="h-[450px] w-full">
                  <RecentActivity />
                </div>
              </>
            ) : (
              <Card className="h-[450px] flex items-center justify-center p-8 shadow-sm border border-slate-200 rounded-2xl bg-white">
                <div className="text-center">
                  <div className="bg-slate-50 p-5 rounded-full inline-flex border border-slate-100 mb-5 shadow-inner">
                    <MapPin className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">No Location Selected</h3>
                  <p className="text-[14px] font-medium text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
                    Please select an active assignment to view live audit statistics and recent activity here.
                  </p>
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