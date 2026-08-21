import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { AlertCircle, CheckCircle2, MapPin, Send, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Dynamic Text Scaler ───────────────────────────────────────────────────────
const AutoScaledNumber = ({ value, prefix = "", className = "" }: { value: number, prefix?: string, className?: string }) => {
  // Cap decimals to 3 places to avoid infinitely long float strings
  const str = prefix + value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  const len = str.length;
  
  // Step down font size based on character count
  let sizeClass = "text-3xl";
  if (len >= 15) sizeClass = "text-lg"; 
  else if (len >= 12) sizeClass = "text-xl";
  else if (len >= 9) sizeClass = "text-2xl";

  return (
    <div 
      className={`${sizeClass} font-black tracking-tight truncate w-full ${className}`} 
      title={str}
    >
      {str}
    </div>
  );
};

export const InventoryOverview = () => {
  const navigate = useNavigate();
  const { locations, assignments, submitAudit, itemMaster, auditedItems } = useInventory();
  const { selectedAssignmentId } = useCompany();
  const { currentUser } = useUser();
  const { isClientUser } = useUserAccess();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentAssignment = assignments.find(a => String(a.id) === String(selectedAssignmentId));
  const locationName = currentAssignment ? locations.find(l => String(l.id) === String(currentAssignment.locationId))?.name : "Unknown Location";
  const auditStatus = currentAssignment?.status || "pending";
  
  const isAuditor = currentUser?.role === 'auditor';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isClient = isClientUser();

  const latestItems = useMemo(() => {
    if (!selectedAssignmentId) return [];
    const auditedMap = new Map();
    auditedItems.forEach(item => auditedMap.set(item.id, item));
    const results: any[] = [];
    itemMaster.forEach(masterItem => {
      if (String(masterItem.assignmentId) === String(selectedAssignmentId)) {
        results.push(auditedMap.get(masterItem.id) || masterItem);
      }
    });
    return results;
  }, [itemMaster, auditedItems, selectedAssignmentId]);

  const stats = useMemo(() => {
    const totalStock = latestItems.reduce((sum, item) => sum + (Number(item.systemQuantity) || 0), 0);
    const activeAuditedItems = latestItems.filter(item => item.status && item.status !== 'pending');
    const auditedStock = activeAuditedItems.reduce((sum, item) => sum + (Number(item.physicalQuantity) || 0), 0);
    const matchedItems = latestItems.filter(item => item.status === 'matched');
    const matchedStock = matchedItems.reduce((sum, item) => sum + (Number(item.physicalQuantity) || 0), 0);
    const discrepancyItems = latestItems.filter(item => item.status === 'discrepancy');
    const discrepancyStock = discrepancyItems.reduce((sum, item) => sum + ((Number(item.physicalQuantity) || 0) - (Number(item.systemQuantity) || 0)), 0);
    const progressPercentage = totalStock > 0 ? Math.round((auditedStock / totalStock) * 100) : 0;

    return { totalStock, auditedStock, matchedStock, discrepancyStock, progressPercentage, pendingStock: totalStock - auditedStock, totalSkus: latestItems.length, auditedSkus: activeAuditedItems.length };
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

  return (
    <Card className="shadow-none border-none bg-transparent">
      <CardHeader className="p-0 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-slate-500 min-w-0">
            <div className="p-1.5 rounded-md bg-white border border-slate-200 shadow-sm shrink-0">
              <MapPin className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest shrink-0">Location:</span> 
            <span className="text-slate-900 font-bold text-sm tracking-tight truncate" title={locationName}>{locationName}</span>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest border flex items-center gap-2 shadow-sm
              ${auditStatus === 'active' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                auditStatus === 'submitted' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                auditStatus === 'finalized' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                'bg-slate-50 text-slate-600 border-slate-200'}
            `}>
              <div className={`w-2 h-2 rounded-full 
                ${auditStatus === 'active' ? 'bg-blue-500' : 
                  auditStatus === 'submitted' ? 'bg-amber-500' :
                  auditStatus === 'finalized' ? 'bg-emerald-500' :
                  'bg-slate-400'}
              `} />
              {auditStatus === 'active' ? 'Audit Active' : auditStatus === 'submitted' ? 'Submitted for Review' : auditStatus === 'finalized' ? 'Finalized' : 'Pending'}
            </div>

            {auditStatus === 'active' && (isAuditor || isAdmin) && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm h-8 text-[12px] font-bold tracking-wide transition-all active:scale-95" onClick={handleSubmitReport} disabled={isSubmitting}>
                <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Report
              </Button>
            )}

            {auditStatus === 'submitted' && (isClient || isAdmin) && (
               <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 rounded-md h-8 text-[12px] font-bold tracking-wide transition-all active:scale-95 bg-white shadow-sm" onClick={() => navigate("/reports")}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Review & Finalize
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {latestItems.length === 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl bg-white border border-slate-200 shadow-sm" />)}
          </div>
        )}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${latestItems.length === 0 ? "hidden" : ""}`}>
          
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300 group overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest truncate pr-2">Total Stock</span>
              <div className="p-2 bg-blue-50 rounded-lg group-hover:scale-110 transition-transform duration-300 border border-blue-100 shrink-0">
                <Boxes className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <AutoScaledNumber value={stats.totalStock} className="text-slate-900 group-hover:text-blue-700 transition-colors" />
            <div className="text-[11px] font-medium text-slate-500 mt-2 truncate">Total items in system</div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300 group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest truncate pr-2">Quantity Found</span>
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shrink-0">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              </div>
            </div>
            <AutoScaledNumber value={stats.auditedStock} className="text-slate-900 relative z-10" />
            <div className="text-[11px] font-bold text-blue-600 mt-2 relative z-10 truncate">{stats.progressPercentage}% of total stock</div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300 group overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest truncate pr-2">Matched Qty</span>
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 group-hover:scale-110 transition-transform duration-300 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <AutoScaledNumber value={stats.matchedStock} className="text-slate-900 group-hover:text-emerald-700 transition-colors" />
            <div className="text-[11px] font-medium text-slate-500 mt-2 truncate">Quantity fully matched</div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-300 group overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest truncate pr-2">Net Variance</span>
              <div className="p-2 bg-rose-50 rounded-lg border border-rose-100 group-hover:scale-110 transition-transform duration-300 shrink-0">
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
            </div>
            <AutoScaledNumber 
               value={stats.discrepancyStock} 
               prefix={stats.discrepancyStock > 0 ? "+" : ""}
               className={`${stats.discrepancyStock < 0 ? 'text-amber-600' : stats.discrepancyStock > 0 ? 'text-rose-600' : 'text-slate-900'}`} 
            />
            <div className="text-[11px] font-medium text-slate-500 mt-2 truncate">Physical vs System Qty</div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex justify-between text-[11px] mb-2 font-bold">
            <span className="text-slate-500 uppercase tracking-widest truncate">Audit Progress (by Volume)</span>
            <span className="text-blue-600 shrink-0 pl-2">{stats.progressPercentage}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-blue-600 transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${Math.min(stats.progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between text-[11px] font-medium text-slate-500 mt-2 gap-1 sm:gap-4">
            <span className="truncate">{stats.auditedSkus.toLocaleString()} of {stats.totalSkus.toLocaleString()} SKUs touched</span>
            <span className="truncate">{stats.auditedStock.toLocaleString(undefined, {maximumFractionDigits: 3})} of {stats.totalStock.toLocaleString(undefined, {maximumFractionDigits: 3})} quantity found</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};