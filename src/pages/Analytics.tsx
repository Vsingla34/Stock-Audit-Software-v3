import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import SupabaseDataService from "@/services/SupabaseDataService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts";
import { format, parseISO } from "date-fns";
import { AlertCircle, TrendingUp, TrendingDown, Minus, Users, Search, Activity, Layers, ArrowRight, Hash } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { toastError } from "@/lib/handleError";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Analytics = () => {
  const { auditedItems, itemMaster, assignments, locations } = useInventory();
  const { selectedAssignmentId, selectedCompanyId } = useCompany();
  const { currentUser } = useUser();
  const [mounted, setMounted] = useState(false);
  
  const [previousReport, setPreviousReport] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [skuSearchQuery, setSkuSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  const [skuVisibleCount, setSkuVisibleCount] = useState(50);
  const [categoryVisibleCount, setCategoryVisibleCount] = useState(50);

  // Trigger entrance animations
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => { setSkuVisibleCount(50); }, [skuSearchQuery]);
  useEffect(() => { setCategoryVisibleCount(50); }, [categorySearchQuery]);

  const currentAssignment = useMemo(() => assignments.find(a => a.id === selectedAssignmentId), [assignments, selectedAssignmentId]);
  const currentLocation = useMemo(() => locations.find(l => l.id === currentAssignment?.locationId), [locations, currentAssignment]);
  const locationName = currentLocation?.name || "Unknown Location";

  const currentItemsMaster = useMemo(() => itemMaster.filter(i => i.location === locationName), [itemMaster, locationName]);
  const currentAuditedItems = useMemo(() => auditedItems.filter(i => i.location === locationName), [auditedItems, locationName]);

  const latestItems = useMemo(() => {
    const auditedMap = new Map();
    currentAuditedItems.forEach(item => auditedMap.set(item.id, item));
    const results: any[] = [];
    currentItemsMaster.forEach(masterItem => { results.push(auditedMap.get(masterItem.id) || masterItem); });
    return results;
  }, [currentItemsMaster, currentAuditedItems]);

  const currentStats = useMemo(() => {
    let expectedQty = 0, foundQty = 0, matchedQty = 0, varianceQty = 0, pendingQty = 0;
    currentItemsMaster.forEach(item => {
      const sq = Number(item.systemQuantity) || 0;
      expectedQty += sq;
      if (!item.status || item.status === 'pending') pendingQty += sq;
    });

    currentAuditedItems.forEach(item => {
      const pq = Number(item.physicalQuantity) || 0;
      const sq = Number(item.systemQuantity) || 0;
      foundQty += pq;
      if (item.status === 'matched' || (item.status !== 'pending' && pq === sq)) matchedQty += pq;
      else if (item.status === 'discrepancy') varianceQty += Math.abs(pq - sq);
    });

    const discrepancyRate = foundQty > 0 ? (varianceQty / foundQty) * 100 : 0;
    const matchRate = foundQty > 0 ? (matchedQty / foundQty) * 100 : 0;
    return { expectedQty, foundQty, pendingQty, varianceQty, matchedQty, discrepancyRate, matchRate };
  }, [currentItemsMaster, currentAuditedItems]);

  useEffect(() => {
    const fetchPrevious = async () => {
      if (!selectedCompanyId || !currentAssignment) return;
      setLoadingHistory(true);
      try {
        const history = await SupabaseDataService.getAuditHistory(selectedCompanyId);
        const locationReports = history.filter((r: any) => {
           const rLocName = r.locations?.name || r.report_data?.metadata?.location_name;
           return rLocName === locationName && r.assignment_id !== currentAssignment.id;
        });
        setPreviousReport(locationReports.length > 0 ? locationReports[0] : null);
      } catch (e) {
        toastError(e, "Failed to load audit history. Please refresh.");
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchPrevious();
  }, [selectedCompanyId, currentAssignment, locationName]);

  const comparisonData = useMemo(() => {
    const items = previousReport?.report_data?.items || [];
    let prevFoundQty = 0, prevMatchedQty = 0, prevVarianceQty = 0;

    if (items.length > 0) {
      items.forEach((item: any) => {
        const isAudited = (item.status && item.status !== 'pending') || (item.physical_quantity !== undefined && item.physical_quantity !== null && item.physical_quantity !== "");
        if (isAudited) {
          const sq = Number(item.system_quantity || 0), pq = Number(item.physical_quantity || 0);
          const variance = Math.abs(pq - sq);
          prevFoundQty += pq;
          if (item.status === 'matched' || variance === 0 || sq === pq) prevMatchedQty += pq;
          else prevVarianceQty += variance;
        }
      });
    } else if (previousReport?.report_data?.summary) {
      const s = previousReport.report_data.summary;
      prevFoundQty = Number(s.totalPhysicalQty || 0);
      prevVarianceQty = Number(s.discrepancies || 0); 
    }

    const prevDiscRate = prevFoundQty > 0 ? (prevVarianceQty / prevFoundQty) * 100 : 0;
    const prevMatchRate = prevFoundQty > 0 ? (prevMatchedQty / prevFoundQty) * 100 : 0;

    return {
      chart: [
        { metric: "Discrepancy %", Previous: previousReport ? Number(prevDiscRate.toFixed(1)) : 0, Current: Number(currentStats.discrepancyRate.toFixed(1)) },
        { metric: "Match %", Previous: previousReport ? Number(prevMatchRate.toFixed(1)) : 0, Current: Number(currentStats.matchRate.toFixed(1)) }
      ],
      prevStats: { foundQty: prevFoundQty }
    };
  }, [previousReport, currentStats]);

  const categoryData = useMemo(() => {
    const categories: Record<string, { expectedQty: number; varianceQty: number }> = {};
    currentAuditedItems.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (!categories[cat]) categories[cat] = { expectedQty: 0, varianceQty: 0 };
      const sq = Number(item.systemQuantity) || 0, pq = Number(item.physicalQuantity) || 0;
      categories[cat].expectedQty += sq;
      if (item.status === 'discrepancy') categories[cat].varianceQty += Math.abs(pq - sq);
    });

    return Object.entries(categories)
      .map(([name, { expectedQty, varianceQty }]) => ({ name, rate: expectedQty > 0 ? Math.round((varianceQty / expectedQty) * 100) : (varianceQty > 0 ? 100 : 0), totalQty: expectedQty }))
      .filter(i => i.totalQty > 0 || i.rate > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [currentAuditedItems]);

  const auditTrendData = useMemo(() => {
    const trendMap: Record<string, number> = {};
    currentAuditedItems.forEach(item => {
      item.auditorEntries?.forEach(entry => {
          if (entry.auditedAt) {
              try {
                  const dateKey = format(parseISO(entry.auditedAt), 'yyyy-MM-dd');
                  trendMap[dateKey] = (trendMap[dateKey] || 0) + (Number(entry.quantityFound) || 0);
              } catch {}
          }
      });
    });
    return Object.entries(trendMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  }, [currentAuditedItems]);

  const allAuditorPerformanceData = useMemo(() => {
    const counts: Record<string, number> = {};
    currentAuditedItems.forEach(item => {
      item.auditorEntries?.forEach(entry => {
        const name = entry.auditorName || "Unknown";
        counts[name] = (counts[name] || 0) + (Number(entry.quantityFound) || 0);
      });
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [currentAuditedItems]);

  const topAuditorsChartData = useMemo(() => allAuditorPerformanceData.slice(0, 10), [allAuditorPerformanceData]);

  const statusData = [
    { name: "Matched Qty", value: currentStats.matchedQty, color: "#10b981" },
    { name: "Variance Qty", value: currentStats.varianceQty, color: "#f43f5e" },
    { name: "Pending Expected", value: currentStats.pendingQty, color: "#94a3b8" },
  ];

  const allVarianceData = useMemo(() => {
    return latestItems.filter(item => item.status && item.status !== 'pending').map(item => ({
        sku: item.sku, variance: (Number(item.physicalQuantity) || 0) - (Number(item.systemQuantity) || 0)
      })).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)); 
  }, [latestItems]);

  const filteredVarianceData = useMemo(() => {
    if (!skuSearchQuery) return allVarianceData;
    return allVarianceData.filter(v => v.sku.toLowerCase().includes(skuSearchQuery.toLowerCase()));
  }, [allVarianceData, skuSearchQuery]);

  const visibleVarianceData = useMemo(() => filteredVarianceData.slice(0, skuVisibleCount), [filteredVarianceData, skuVisibleCount]);

  const allCategoryProgress = useMemo(() => {
    const categoryMap = new Map();
    latestItems.forEach(item => {
        const cat = item.category && item.category !== "-" ? item.category : 'Uncategorized';
        if (!categoryMap.has(cat)) categoryMap.set(cat, { name: cat, current: 0, total: 0 });
        const catData = categoryMap.get(cat);
        catData.total += 1;
        if (item.status && item.status !== 'pending') catData.current += 1;
    });
    return Array.from(categoryMap.values()).sort((a, b) => b.total - a.total); 
  }, [latestItems]);

  const filteredCategoryProgress = useMemo(() => {
    if (!categorySearchQuery) return allCategoryProgress;
    return allCategoryProgress.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()));
  }, [allCategoryProgress, categorySearchQuery]);

  const visibleCategoryData = useMemo(() => filteredCategoryProgress.slice(0, categoryVisibleCount), [filteredCategoryProgress, categoryVisibleCount]);

  const handleSkuScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && skuVisibleCount < filteredVarianceData.length) {
        setSkuVisibleCount(prev => prev + 50);
    }
  };

  const handleCategoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && categoryVisibleCount < filteredCategoryProgress.length) {
        setCategoryVisibleCount(prev => prev + 50);
    }
  };

  // ── Custom Interactive Tooltip ──
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)]">
          <p className="text-[13px] font-black text-slate-800 mb-2 pb-2 border-b border-slate-100">{label || payload[0].name}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3 text-[13px] font-medium mt-1.5">
              <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="text-slate-500 capitalize">{entry.name}:</span>
              <span className="font-black text-slate-900 ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!selectedAssignmentId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[80vh] text-center px-4 animate-in fade-in zoom-in duration-500">
          <div className="bg-white p-6 rounded-full border border-slate-200 mb-6 shadow-xl shadow-slate-200/50 hover:scale-110 transition-transform duration-500">
            <Activity className="h-10 w-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">No Assignment Selected</h2>
          <p className="text-[14px] font-medium text-slate-500 max-w-md mt-3 leading-relaxed">
            Please select an active assignment from the dashboard to view its real-time analytics and history comparison.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      
      {/* CSS For Staggered Animations */}
      <style>
        {`
          @keyframes slideFadeUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-stagger { opacity: 0; animation: slideFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .delay-100 { animation-delay: 100ms; }
          .delay-200 { animation-delay: 200ms; }
          .delay-300 { animation-delay: 300ms; }
          .delay-400 { animation-delay: 400ms; }
        `}
      </style>

      <div className="space-y-8 w-full max-w-full overflow-x-hidden min-h-screen bg-slate-50/30 pb-20">
        
        {/* ── Premium Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200 animate-in fade-in duration-700">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-3 bg-white border border-slate-200 shadow-md rounded-2xl group cursor-pointer hover:border-blue-300 hover:shadow-blue-500/20 transition-all duration-300">
                <Activity className="h-6 w-6 text-blue-600 group-hover:scale-110 transition-transform duration-300" />
              </div>
              Volume Analytics
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-4 pl-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-sm cursor-default hover:bg-blue-100 transition-colors">
                {locationName}
              </span>
              <span>•</span>
              <span className="cursor-default hover:text-slate-800 transition-colors">
                {currentAssignment?.scheduledDate ? format(new Date(currentAssignment.scheduledDate), "MMMM dd, yyyy") : "Ongoing"}
              </span>
            </div>
          </div>
        </div>

        {/* ── COMPARISON SECTION ── */}
        {previousReport ? (
           <Card className={`border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-blue-200 rounded-[24px] overflow-hidden transition-all duration-500 group animate-stagger ${mounted ? 'opacity-100' : ''}`}>
             <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5 group-hover:bg-blue-50/30 transition-colors duration-500">
               <CardTitle className="flex items-center gap-2.5 text-slate-900 font-black text-lg tracking-tight">
                 <TrendingUp className="h-5 w-5 text-blue-600 group-hover:scale-110 transition-transform" /> 
                 Current vs Previous Audit
               </CardTitle>
               <CardDescription className="text-[13px] font-medium text-slate-500">
                 Comparing performance against audit finalized on {format(new Date(previousReport.finalized_at), "MMM dd, yyyy")}
               </CardDescription>
             </CardHeader>
             
             <CardContent className="pt-6">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.chart} layout="vertical" barGap={8} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="metric" type="category" width={120} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(37, 99, 235, 0.05)'}} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', paddingTop: '10px' }} />
                      <Bar dataKey="Previous" fill="#94a3b8" radius={[0, 6, 6, 0]} name="Previous Audit" barSize={20} className="hover:opacity-80 transition-opacity cursor-pointer" />
                      <Bar 
                        dataKey="Current" 
                        fill={comparisonData.chart[0].Current < comparisonData.chart[0].Previous ? "#10b981" : "#2563eb"} 
                        radius={[0, 6, 6, 0]} 
                        name="Current Audit" 
                        barSize={20}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Insights Summary */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
                   <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 hover:border-emerald-200 transition-all duration-300 cursor-default">
                      {currentStats.discrepancyRate < (comparisonData.chart[0].Previous || 0) ? (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 shadow-inner">
                          <TrendingDown className="h-7 w-7 text-emerald-600" />
                        </div>
                      ) : (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 shadow-inner">
                          <TrendingUp className="h-7 w-7 text-rose-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase font-black tracking-widest mb-1">Error Rate Trend</p>
                        <p className="text-[16px] font-black text-slate-900 tracking-tight">
                           {currentStats.discrepancyRate < (comparisonData.chart[0].Previous || 0) 
                             ? "Improved (Lower errors)" : "Regressed (Higher errors)"}
                        </p>
                      </div>
                   </div>
                   
                   <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 transition-all duration-300 cursor-default">
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 shadow-inner">
                        <Minus className="h-7 w-7 text-blue-600" />
                      </div>
                      <div>
                          <p className="text-[11px] text-slate-400 uppercase font-black tracking-widest mb-1">Volume Comparison</p>
                          <p className="text-[16px] font-black text-slate-900 tracking-tight">
                             {currentStats.foundQty} Qty vs {comparisonData.prevStats.foundQty} Qty prev
                          </p>
                      </div>
                   </div>
                </div>
             </CardContent>
           </Card>
        ) : (
           <Alert className={`bg-blue-50 border border-blue-200 text-blue-900 rounded-[20px] p-6 shadow-md animate-stagger ${mounted ? 'opacity-100' : ''}`}>
             <AlertCircle className="h-6 w-6 text-blue-600" />
             <AlertTitle className="font-black text-[16px] tracking-tight ml-3">Baseline Audit</AlertTitle>
             <AlertDescription className="font-medium text-[14px] ml-3 mt-1.5 opacity-80">
               No previous finalized audit history found for {locationName}. This is currently acting as your baseline audit.
             </AlertDescription>
           </Alert>
        )}

        <h2 className={`text-[12px] font-black uppercase tracking-widest text-slate-500 pt-6 border-b border-slate-200 pb-3 animate-stagger delay-100 ${mounted ? 'opacity-100' : ''}`}>
          Real-Time Progress
        </h2>

        {/* ── MAIN ANALYTICS GRID ── */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Status Pie Chart */}
          <Card className={`rounded-[24px] border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-500 bg-white animate-stagger delay-100 ${mounted ? 'opacity-100' : ''}`}>
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-[15px] font-black text-slate-800 tracking-tight flex items-center justify-between">
                Audit Progress (By Quantity)
                <Layers className="h-4 w-4 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} dataKey="value" stroke="none" paddingAngle={3}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 hover:scale-105 transition-all duration-300 cursor-pointer origin-center" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Activity Trend Line Chart */}
          <Card className={`rounded-[24px] border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-500 bg-white animate-stagger delay-100 ${mounted ? 'opacity-100' : ''}`}>
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-[15px] font-black text-slate-800 tracking-tight flex items-center justify-between">
                Daily Scan Velocity
                <Activity className="h-4 w-4 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={auditTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={(t) => format(parseISO(t), 'MMM dd')} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} labelFormatter={(t) => format(parseISO(t), 'MMMM dd, yyyy')} />
                  <Line type="monotone" dataKey="count" name="Quantity Scanned" stroke="#2563eb" strokeWidth={4} dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#1d4ed8' }} animationDuration={1500} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Auditor Leaderboard Bar Chart */}
          <Card className={`rounded-[24px] border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-500 bg-white animate-stagger delay-200 ${mounted ? 'opacity-100' : ''}`}>
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-[15px] font-black text-slate-800 tracking-tight flex items-center justify-between">
                Top 10 Auditors
                <Users className="h-4 w-4 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAuditorsChartData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(37, 99, 235, 0.05)'}} />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} name="Quantity Found" barSize={18} className="hover:opacity-80 transition-opacity cursor-pointer" animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Error Rate by Category Bar Chart */}
          <Card className={`rounded-[24px] border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-500 bg-white animate-stagger delay-200 ${mounted ? 'opacity-100' : ''}`}>
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-[15px] font-black text-slate-800 tracking-tight flex items-center justify-between">
                High Error Categories
                <AlertCircle className="h-4 w-4 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} interval={0} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                   <YAxis unit="%" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                   <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(245, 158, 11, 0.05)'}} />
                   <Bar dataKey="rate" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Variance %" barSize={24} className="hover:opacity-80 transition-opacity cursor-pointer" animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>

        {/* ── SCROLLABLE DATA VISUALIZATION GRID ── */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 items-stretch mb-8 animate-stagger delay-300 ${mounted ? 'opacity-100' : ''}`}>
          
          {/* Left Card - Variance by SKU */}
          <Card className="shadow-sm hover:shadow-xl transition-shadow duration-500 border border-slate-200 rounded-[24px] p-6 flex flex-col h-full bg-white">
             <div className="text-[16px] font-black text-slate-900 mb-5 border-b border-slate-100 pb-3 flex items-center justify-between">
               Variance by SKU
               <Hash className="h-4 w-4 text-slate-400" />
             </div>
             
             <div className="relative mb-5 shrink-0 group">
               <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
               <Input
                  placeholder="Search SKU..."
                  className="w-full h-11 pl-11 text-[13px] font-medium rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 shadow-sm transition-all"
                  value={skuSearchQuery}
                  onChange={e => setSkuSearchQuery(e.target.value)}
               />
             </div>

             <div className="flex-1 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar" onScroll={handleSkuScroll}>
                {visibleVarianceData.length > 0 ? (
                  <div style={{ height: `${Math.max(250, visibleVarianceData.length * 45)}px`, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={visibleVarianceData} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                         <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                         <YAxis dataKey="sku" type="category" tick={{ fontSize: 11, fill: '#475569', fontWeight: 'bold' }} axisLine={false} tickLine={false} width={100} />
                         <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
                         <Bar dataKey="variance" radius={[0, 4, 4, 0]} barSize={20} className="cursor-pointer hover:opacity-80 transition-opacity">
                           {visibleVarianceData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.variance < 0 ? '#f43f5e' : entry.variance > 0 ? '#10b981' : '#cbd5e1'} />
                           ))}
                         </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-[13px] font-bold text-slate-400">
                    {skuSearchQuery ? "No SKUs match search." : "No variances recorded yet."}
                  </div>
                )}
             </div>

             <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-5 pt-4 border-t border-slate-100 shrink-0 text-center">
               Showing {visibleVarianceData.length} of {filteredVarianceData.length} active SKUs
             </div>
          </Card>

          {/* Right Card - Progress by category */}
          <Card className="shadow-sm hover:shadow-xl transition-shadow duration-500 border border-slate-200 rounded-[24px] p-6 flex flex-col h-full bg-white">
             <div className="text-[16px] font-black text-slate-900 mb-5 border-b border-slate-100 pb-3 flex items-center justify-between">
               Progress by Category
               <Layers className="h-4 w-4 text-slate-400" />
             </div>
             
             <div className="relative mb-5 shrink-0 group">
               <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
               <Input
                  placeholder="Search category..."
                  className="w-full h-11 pl-11 text-[13px] font-medium rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 shadow-sm transition-all"
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
               />
             </div>

             <div className="flex-1 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar" onScroll={handleCategoryScroll}>
                <div className="flex flex-col min-h-[200px] gap-2">
                  {visibleCategoryData.map((cat, i) => {
                      const percentage = cat.total > 0 ? Math.round((cat.current / cat.total) * 100) : 0;
                      
                      let barColor = '#f43f5e'; // Rose
                      let textColor = 'text-rose-500';
                      
                      if (percentage >= 100) { barColor = '#2563eb'; textColor = 'text-blue-600'; } // Blue
                      else if (percentage >= 50) { barColor = '#f59e0b'; textColor = 'text-amber-500'; } // Amber
                      
                      return (
                          <div key={i} className="group flex items-center p-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all duration-300 cursor-default hover:-translate-y-0.5">
                              <div className="w-[120px] text-[13px] font-bold text-slate-700 truncate pr-3 group-hover:text-blue-700 transition-colors" title={cat.name}>
                                {cat.name}
                              </div>
                              <div className="flex-1 mx-3 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                  <div 
                                    className="h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-110" 
                                    style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }} 
                                  />
                              </div>
                              <div className="w-[55px] text-right text-[12px] font-black text-slate-400 tracking-tight group-hover:text-blue-400 transition-colors">
                                {cat.current}/{cat.total}
                              </div>
                              <div className={`w-[50px] text-right text-[13px] font-black ${textColor} group-hover:scale-110 transition-transform origin-right`}>
                                {percentage}%
                              </div>
                          </div>
                      )
                  })}
                  {visibleCategoryData.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[13px] font-bold text-slate-400 py-12">
                      {categorySearchQuery ? "No categories match search." : "No categories found."}
                    </div>
                  )}
                </div>
             </div>

             <div className="mt-auto pt-5 border-t border-slate-100 shrink-0">
                <div className="flex flex-wrap items-center justify-center gap-5 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm" />
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Complete</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">In progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">At risk</span>
                    </div>
                </div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2 text-center">
                    Showing {visibleCategoryData.length} of {filteredCategoryProgress.length} active categories
                </div>
             </div>
          </Card>

        </div>

        {/* ── FULL AUDITOR BREAKDOWN TABLE ── */}
        <Card className={`border-slate-200 shadow-sm mt-10 rounded-[24px] overflow-hidden bg-white hover:shadow-xl transition-shadow duration-500 animate-stagger delay-400 ${mounted ? 'opacity-100' : ''}`}>
          <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-5">
            <CardTitle className="flex items-center gap-3 text-slate-900 font-black text-xl tracking-tight">
              <div className="p-2 bg-blue-100 rounded-lg border border-blue-200">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              Auditor Scan Summary
            </CardTitle>
            <CardDescription className="text-[14px] font-medium text-slate-500 mt-2">
              Total physical quantity collected by every auditor during this assignment.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest text-slate-500 h-14 pl-8">Auditor Account / Email</TableHead>
                  <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest text-slate-500 h-14 pr-8">Total Quantity Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAuditorPerformanceData.length > 0 ? (
                  allAuditorPerformanceData.map((auditor, index) => (
                    <TableRow key={index} className="group hover:bg-blue-50/40 transition-colors cursor-pointer border-slate-100">
                      <TableCell className="font-bold text-[15px] text-slate-800 pl-8 py-5 group-hover:text-blue-700 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 font-black text-[13px] group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                            {auditor.name.charAt(0).toUpperCase()}
                          </div>
                          {auditor.name}
                          {auditor.name === currentUser?.email && (
                             <span className="ml-2 text-[10px] bg-blue-600 text-white px-2.5 py-1 rounded-md font-black tracking-widest uppercase shadow-sm">You</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-5 pr-8">
                        <div className="inline-flex items-center gap-2">
                          <span className="font-black text-[18px] text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                            {auditor.count.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-blue-500 transition-all" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-32 text-center text-slate-500 font-bold text-[13px] bg-slate-50/50">
                      No scans have been recorded for this assignment yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
};

export default Analytics;