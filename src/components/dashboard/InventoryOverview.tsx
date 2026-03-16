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
  Boxes,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";

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

  // Search States for the new cards
  const [skuSearchQuery, setSkuSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  // 🔥 PERFORMANCE: Lazy Loading States
  const [skuVisibleCount, setSkuVisibleCount] = useState(50);
  const [categoryVisibleCount, setCategoryVisibleCount] = useState(50);

  // Reset lazy load count when searching
  useEffect(() => {
    setSkuVisibleCount(50);
  }, [skuSearchQuery]);

  useEffect(() => {
    setCategoryVisibleCount(50);
  }, [categorySearchQuery]);

  // 1. Get Current Assignment & Location
  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  
  const locationName = currentAssignment 
    ? locations.find(l => l.id === currentAssignment.locationId)?.name 
    : "Unknown Location";

  const auditStatus = currentAssignment?.status || "pending";
  const isAuditor = currentUser?.role === 'auditor';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isClient = isClientUser();

  // Extract latest items calculation to share between stats and charts
 // 🔥 PERFORMANCE FIX: O(N) Hash Map instead of O(N^2) Array.find()
  const latestItems = useMemo(() => {
    if (!selectedAssignmentId) return [];

    // 1. Create a lightning-fast dictionary of all live audited items
    const auditedMap = new Map();
    auditedItems.forEach(item => auditedMap.set(item.id, item));

    const results: any[] = [];
    
    // 2. Loop the master list ONCE and grab from the dictionary
    itemMaster.forEach(masterItem => {
      if (masterItem.assignmentId === selectedAssignmentId) {
        results.push(auditedMap.get(masterItem.id) || masterItem);
      }
    });

    return results;
  }, [itemMaster, auditedItems, selectedAssignmentId]);

  // 2. Calculate Top Stats
  const stats = useMemo(() => {
    const totalStock = latestItems.reduce((sum, item) => sum + (item.systemQuantity || 0), 0);
    const activeAuditedItems = latestItems.filter(item => item.status && item.status !== 'pending');
    const auditedStock = activeAuditedItems.reduce((sum, item) => sum + (item.physicalQuantity || 0), 0);
    const matchedItems = latestItems.filter(item => item.status === 'matched');
    const matchedStock = matchedItems.reduce((sum, item) => sum + (item.physicalQuantity || 0), 0);
    
    const discrepancyItems = latestItems.filter(item => item.status === 'discrepancy');
    const discrepancyStock = discrepancyItems.reduce((sum, item) => {
        const sys = item.systemQuantity || 0;
        const phy = item.physicalQuantity || 0;
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

  // 3. Dynamic Data for Scalable Charts
  
  // --- VARIANCE BY SKU ---
  const allVarianceData = useMemo(() => {
    return latestItems
      .filter(item => item.status && item.status !== 'pending')
      .map(item => ({
        sku: item.sku,
        variance: (item.physicalQuantity || 0) - (item.systemQuantity || 0)
      }))
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)); 
  }, [latestItems]);

  const filteredVarianceData = useMemo(() => {
    if (!skuSearchQuery) return allVarianceData;
    return allVarianceData.filter(v => v.sku.toLowerCase().includes(skuSearchQuery.toLowerCase()));
  }, [allVarianceData, skuSearchQuery]);

  // Slice data for performance
  const visibleVarianceData = useMemo(() => {
    return filteredVarianceData.slice(0, skuVisibleCount);
  }, [filteredVarianceData, skuVisibleCount]);

  // --- PROGRESS BY CATEGORY ---
  const allCategoryProgress = useMemo(() => {
    const categoryMap = new Map();
    latestItems.forEach(item => {
        const cat = item.category && item.category !== "-" ? item.category : 'Uncategorized';
        if (!categoryMap.has(cat)) {
            categoryMap.set(cat, { name: cat, current: 0, total: 0 });
        }
        const catData = categoryMap.get(cat);
        catData.total += 1;
        if (item.status && item.status !== 'pending') {
            catData.current += 1;
        }
    });

    return Array.from(categoryMap.values())
        .sort((a, b) => b.total - a.total); 
  }, [latestItems]);

  const filteredCategoryProgress = useMemo(() => {
    if (!categorySearchQuery) return allCategoryProgress;
    return allCategoryProgress.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()));
  }, [allCategoryProgress, categorySearchQuery]);

  // Slice data for performance
  const visibleCategoryData = useMemo(() => {
    return filteredCategoryProgress.slice(0, categoryVisibleCount);
  }, [filteredCategoryProgress, categoryVisibleCount]);

  const handleGoToReports = () => navigate("/reports");
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

  // 🔥 PERFORMANCE: Scroll Handlers
  const handleSkuScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    // If scrolled within 50px of the bottom, load more
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (skuVisibleCount < filteredVarianceData.length) {
        setSkuVisibleCount(prev => prev + 50);
      }
    }
  };

  const handleCategoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    // If scrolled within 50px of the bottom, load more
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (categoryVisibleCount < filteredCategoryProgress.length) {
        setCategoryVisibleCount(prev => prev + 50);
      }
    }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          
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
        <div className="mt-6">
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

        {/* Scalable & Scrollable Data Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] mt-[20px] items-stretch">
          
          {/* Left Card - Variance by SKU */}
          <Card className="shadow-none border border-gray-200 rounded-[12px] p-4 flex flex-col">
             <div className="text-[13px] text-gray-500 mb-2">Variance by SKU</div>
             
             {/* Search Input */}
             <div className="relative mb-3 shrink-0">
               <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
               <Input
                  placeholder="Search SKU..."
                  className="w-full h-8 pl-8 text-[12px] rounded border-gray-200"
                  value={skuSearchQuery}
                  onChange={e => setSkuSearchQuery(e.target.value)}
               />
             </div>

             {/* Scrollable Container */}
             <div 
                className="flex-1 max-h-[320px] overflow-y-auto pr-1" 
                style={{ scrollbarWidth: 'thin' }}
                onScroll={handleSkuScroll}
              >
                {visibleVarianceData.length > 0 ? (
                  <div style={{ height: `${Math.max(200, visibleVarianceData.length * 36)}px`, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={visibleVarianceData} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#eee" />
                         <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                         <YAxis dataKey="sku" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
                         <Tooltip 
                           cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                           contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                         />
                         <Bar dataKey="variance" radius={[4, 4, 4, 4]} barSize={16}>
                           {visibleVarianceData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.variance < 0 ? '#F09595' : entry.variance > 0 ? '#97C459' : '#e5e7eb'} />
                           ))}
                         </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[12px] text-gray-400 py-10">
                    {skuSearchQuery ? "No SKUs match search." : "No variances recorded yet."}
                  </div>
                )}
             </div>

             <div className="text-[11px] text-gray-500 mt-3 pt-2 border-t border-gray-100 shrink-0">
                Showing {visibleVarianceData.length} of {filteredVarianceData.length} active SKUs
             </div>
          </Card>

          {/* Right Card - Progress by category */}
          <Card className="shadow-none border border-gray-200 rounded-[12px] p-4 flex flex-col">
             <div className="text-[13px] text-gray-500 mb-2">Progress by category</div>
             
             {/* Search Input */}
             <div className="relative mb-3 shrink-0">
               <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
               <Input
                  placeholder="Search category..."
                  className="w-full h-8 pl-8 text-[12px] rounded border-gray-200"
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
               />
             </div>

             {/* Scrollable Container */}
             <div 
                className="flex-1 max-h-[320px] overflow-y-auto pr-2" 
                style={{ scrollbarWidth: 'thin' }}
                onScroll={handleCategoryScroll}
              >
                <div className="flex flex-col">
                  {visibleCategoryData.map((cat, i) => {
                      const percentage = cat.total > 0 ? Math.round((cat.current / cat.total) * 100) : 0;
                      
                      let barColor = '#F09595'; // Red for At Risk (<50%)
                      let textColor = 'text-[#F09595]';
                      
                      if (percentage >= 100) { 
                        barColor = '#3266ad'; // Blue for Complete
                        textColor = 'text-[#3266ad]'; 
                      } else if (percentage >= 50) { 
                        barColor = '#EF9F27'; // Amber for In Progress (50-99%)
                        textColor = 'text-[#EF9F27]'; 
                      }
                      
                      return (
                          <div key={i} className={`flex items-center py-[10px] ${i !== visibleCategoryData.length - 1 ? 'border-b border-gray-100' : ''}`}>
                              <div className="w-[100px] text-[13px] text-gray-700 truncate pr-2" title={cat.name}>
                                {cat.name}
                              </div>
                              <div className="flex-1 mx-2 h-[6px] bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }} 
                                  />
                              </div>
                              <div className="w-[45px] text-right text-[12px] text-gray-500">
                                {cat.current}/{cat.total}
                              </div>
                              <div className={`w-[35px] text-right text-[11px] font-medium ${textColor}`}>
                                {percentage}%
                              </div>
                          </div>
                      )
                  })}
                  {visibleCategoryData.length === 0 && (
                    <div className="text-center text-[12px] text-gray-400 py-10">
                      {categorySearchQuery ? "No categories match search." : "No categories found."}
                    </div>
                  )}
                </div>
             </div>

             {/* Legend & Summary (Fixed outside scroll) */}
             <div className="mt-auto pt-3 border-t border-gray-100 shrink-0">
                <div className="flex items-center gap-4 mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-[#3266ad]" />
                        <span className="text-[11px] text-gray-500">Complete</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-[#EF9F27]" />
                        <span className="text-[11px] text-gray-500">In progress</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-[#F09595]" />
                        <span className="text-[11px] text-gray-500">At risk</span>
                    </div>
                </div>
                <div className="text-[11px] text-gray-500">
                    Showing {visibleCategoryData.length} of {filteredCategoryProgress.length} active categories
                </div>
             </div>
          </Card>

        </div>

      </CardContent>
    </Card>
  );
};