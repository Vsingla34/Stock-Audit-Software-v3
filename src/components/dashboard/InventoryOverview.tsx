import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { 
  ClipboardList, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  MapPin,
  Send,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

export const InventoryOverview = () => {
  const navigate = useNavigate();
  const { 
    getInventorySummary, 
    locations, 
    assignments, 
    submitAudit 
  } = useInventory();
  
  const { selectedAssignmentId } = useCompany();
  const { currentUser } = useUser();
  const { isClientUser } = useUserAccess();
  
  const summary = getInventorySummary();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Get Current Assignment
  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  
  // 2. Get Location Name
  const locationName = currentAssignment 
    ? locations.find(l => l.id === currentAssignment.locationId)?.name 
    : "Unknown Location";

  // 3. Determine Status strictly from Assignment
  const auditStatus = currentAssignment?.status || "pending";

  const completionPercentage = summary.totalItems > 0 
    ? Math.round((summary.auditedItems / summary.totalItems) * 100) 
    : 0;

  const isAuditor = currentUser?.role === 'auditor';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isClient = isClientUser();

  const handleSubmitReport = async () => {
    if (!selectedAssignmentId) return;
    if (confirm("Are you sure you want to submit this report to the client?")) {
      setIsSubmitting(true);
      try {
        await submitAudit(selectedAssignmentId);
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
            {/* Status Badge */}
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

            {/* Action Buttons */}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
          {/* Total Items */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-gray-500 text-sm font-medium">Total Inventory Items</span>
              <FileText className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalItems}</div>
            <div className="text-xs text-gray-500 mt-1">Total items in inventory</div>
          </div>

          {/* Progress */}
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-indigo-600 text-sm font-medium">Audit Progress</span>
              <div className="h-4 w-4 text-indigo-400">
                 {/* Mini Chart Icon */}
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-indigo-900">{completionPercentage}%</div>
            <div className="text-xs text-indigo-600 mt-1">{summary.auditedItems} of {summary.totalItems} items audited</div>
          </div>

          {/* Matched */}
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-green-600 text-sm font-medium">Matched Items</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-900">{summary.matched}</div>
            <div className="text-xs text-green-600 mt-1">Items with matching quantities</div>
          </div>

          {/* Discrepancies */}
          <div className="p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-red-600 text-sm font-medium">Discrepancies</span>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-900">{summary.discrepancies}</div>
            <div className="text-xs text-red-600 mt-1">Items with quantity discrepancies</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Audit Progress</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{summary.auditedItems} audited</span>
            <span>{summary.pendingItems} pending</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};