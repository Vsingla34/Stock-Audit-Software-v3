import { toastError } from "@/lib/handleError";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { InventoryOverview } from "@/components/dashboard/InventoryOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Barcode, Search, ClipboardList, Upload, FileSpreadsheet } from "lucide-react";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { canUploadData, canPerformAudits, isClientUser } = useUserAccess();
  const { currentUser } = useUser();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!selectedCompanyId) return;
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("name")
          .eq("id", selectedCompanyId)
          .single();
        
        if (data && !error) {
          setCompanyName(data.name);
        }
      } catch (err) {
        toastError(err, "Failed to load company info.");
      }
    };
    fetchCompanyName();
  }, [selectedCompanyId]);

  const isClient = isClientUser();

  return (
    <AppLayout>
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
              Welcome back, <span className="text-indigo-600">{currentUser?.name}</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground">
              Dashboard
            </p>
          </div>

          <div className="text-left md:text-right w-full md:w-auto">
            {companyName && (
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 truncate">
                {companyName}
              </h2>
            )}
            {selectedAssignmentId && (
              <p className="text-sm text-gray-500 font-medium mt-1">
                Assignment ID: <span className="text-indigo-600">#{selectedAssignmentId}</span>
              </p>
            )}
          </div>
        </div>

        {/* Inventory Overview Component */}
        <InventoryOverview />

        {/* Main Grid: Activity & Actions */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Recent Activity: constrained height for mobile matching */}
          <div className="h-full min-h-[400px]">
             <RecentActivity />
          </div>
          
          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
            
            {/* Mobile: Stack (1 col), Tablet+: 2 Cols */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {isClient ? (
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
            
            {(canUploadData() || canPerformAudits()) && !isClient && (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mt-2">
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

        {/* Inventory Table Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Inventory Status</h2>
          </div>
          
          {/* Ensure table has horizontal scroll on small screens */}
          <div className="overflow-x-auto">
             <InventoryTable />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;