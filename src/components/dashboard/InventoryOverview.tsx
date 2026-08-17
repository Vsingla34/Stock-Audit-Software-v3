import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { 
  AlertCircle, 
  CheckCircle2, 
  MapPin,
  Send,
  Boxes
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusBadge } from "@/lib/statusConfig";

export const InventoryOverview = () => {
  const navigate = useNavigate();
  const { 
    locations, 
    assignments, 
    submitAudit,
    itemMaster,
    auditedItems
  } = useInventory();
  
  const { selectedAssignmentId } = useCompany();
  const { currentUser } = useUser();
  const { isClientUser } = useUserAccess();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Get Current Assignment & Location
  const currentAssignment = assignments.find(a => String(a.id) === String(selectedAssignmentId));
  
  const locationName = currentAssignment 
    ? locations.find(l => String(l.id) === String(currentAssignment.locationId))?.name 
    : "Unknown Location";

  const auditStatus = currentAssignment?.status || "pending";
  const isAuditor = currentUser?.role === 'auditor';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isClient = isClientUser();

  // 🔥 CRITICAL FIX: Wrap in String() so Javascript doesn't fail the equality check between Number and String!
  const latestItems = useMemo(() => {
    if (!selectedAssignmentId) return [];

    // 1. Create a lightning-fast dictionary of all live audited items
    const auditedMap = new Map();
    auditedItems.forEach(item => auditedMap.set(item.id, item));

    const results: any[] = [];
    
    // 2. Loop the master list ONCE and grab from the dictionary
    itemMaster.forEach(masterItem => {
      // THIS is where the dashboard was dropping real-time updates! 
      if (String(masterItem.assignmentId) === String(selectedAssignmentId)) {
        results.push(auditedMap.get(masterItem.id) || masterItem);
      }
    });

    return results;
  }, [itemMaster, auditedItems, selectedAssignmentId]);

  // 2. Calculate Top Stats
  const stats = useMemo(() => {
    const totalStock = latestItems.reduce((sum, item) => sum + (Number(item.systemQuantity) || 0), 0);
    const activeAuditedItems = latestItems.filter(item => item.status && item.status !== 'pending');
    const auditedStock = activeAuditedItems.reduce((sum, item) => sum + (Number(item.physicalQuantity) || 0), 0);
    const matchedItems = latestItems.filter(item => item.status === 'matched');
    const matchedStock = matchedItems.reduce((sum, item) => sum + (Number(item.physicalQuantity) || 0), 0);
    
    const discrepancyItems = latestItems.filter(item => item.status === 'discrepancy');
    const discrepancyStock = discrepancyItems.reduce((sum, item) => {
        const sys = Number(item.systemQuantity) || 0;
        const phy = Number(item.physicalQuantity) || 0;
        return sum + (phy - sys);
    }, 0);

    const progressPercentage = totalStock > 0 
      ? Math.round((auditedStock / totalStock) * 100) 
      : 0;

    return {
      totalStock,
      auditedStock,
      matchedStock,
      discrepancyStock,
      progressPercentage,
      pendingStock: totalStock - auditedStock,
      totalSkus: latestItems.length,
      auditedSkus: activeAuditedItems.length
    };
  }, [latestItems]);

  const handleSubmitReport = async () => {
    if (!selectedAssignmentId) return;
    if (confirm("Are you sure you want to submit this report to the client?")) {
      setIsSubmitting(true);
      try {
        await submitAudit(Number(selectedAssignmentId));
        toast.success("Audit Submitted Successfully");
      } catch (e: any) {
        toast.error(e.message || "Failed to submit");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGoToReports = () => {
    navigate("/reports");
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">Current Location:</span> 
            <span className="text-gray-900 font-semibold">{locationName}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5
              ${auditStatus === 'active' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                auditStatus === 'submitted' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                auditStatus === 'finalized' ? 'bg-green-50 text-green-700 border-green-200' :
                'bg-gray-100 text-gray-600 border-gray-200'}
            `}>
              <div className={`w-1.5 h-1.5 rounded-full 
                ${auditStatus === 'active' ? 'bg-indigo-500' : 
                  auditStatus === 'submitted' ? 'bg-yellow-500' :
                  auditStatus === 'finalized' ? 'bg-green-500' :
                  'bg-gray-400'}
              `} />
              {auditStatus === 'active' ? 'Audit Active' : 
               auditStatus === 'submitted' ? 'Submitted for Review' : 
               auditStatus === 'finalized' ? 'Finalized' : 'Pending'}
            </div>

            {auditStatus === 'active' && (isAuditor || isAdmin) && (
              <Button 
                size="sm" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                onClick={handleSubmitReport}
                disabled={isSubmitting}
              >
                <Send className="w-3 h-3 mr-2" />
                Submit Report
              </Button>
            )}

            {auditStatus === 'submitted' && (isClient || isAdmin) && (
               <Button 
                size="sm" 
                variant="outline"
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                onClick={handleGoToReports}
              >
                <CheckCircle2 className="w-3 h-3 mr-2" />
                Review & Finalize
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Adjusted Grid Layout */}
        {/* Fix 4.6: skeleton while data loads */}
        {latestItems.length === 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2 ${latestItems.length === 0 ? "hidden" : ""}`}>
          
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-blue-600 text-sm font-medium">Total Stock</span>
              <Boxes className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-900">{stats.totalStock.toLocaleString()}</div>
            <div className="text-xs text-blue-600 mt-1">Total items in system</div>
          </div>

          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-indigo-600 text-sm font-medium">Quantity Found</span>
              <div className="h-4 w-4 text-indigo-400">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-indigo-900">{stats.auditedStock.toLocaleString()}</div>
            <div className="text-xs text-indigo-600 mt-1">
                {stats.progressPercentage}% of total stock
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-green-600 text-sm font-medium">Matched Qty</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-900">{stats.matchedStock.toLocaleString()}</div>
            <div className="text-xs text-green-600 mt-1">Quantity fully matched</div>
          </div>

          <div className="p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-red-600 text-sm font-medium">Net Variance</span>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className={`text-2xl font-bold ${stats.discrepancyStock < 0 ? 'text-orange-700' : 'text-red-900'}`}>
                {stats.discrepancyStock > 0 ? "+" : ""}{stats.discrepancyStock.toLocaleString()}
            </div>
            <div className="text-xs text-red-600 mt-1">Physical - System Qty</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Audit Progress (by Volume)</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.min(stats.progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{stats.auditedSkus} of {stats.totalSkus} SKUs touched</span>
            <span>{stats.auditedStock.toLocaleString()} of {stats.totalStock.toLocaleString()} quantity found</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};