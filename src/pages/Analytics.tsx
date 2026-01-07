import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import SupabaseDataService from "@/services/SupabaseDataService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";
import { format, parseISO } from "date-fns";
import { AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Analytics = () => {
  const { auditedItems, itemMaster, assignments, locations } = useInventory();
  const { selectedAssignmentId, selectedCompanyId } = useCompany();
  
  const [previousReport, setPreviousReport] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 1. Identify Current Assignment Context
  const currentAssignment = useMemo(() => 
    assignments.find(a => a.id === selectedAssignmentId), 
  [assignments, selectedAssignmentId]);

  const currentLocation = useMemo(() => 
    locations.find(l => l.id === currentAssignment?.locationId),
  [locations, currentAssignment]);

  const locationName = currentLocation?.name || "Unknown Location";

  // 2. Filter Data for Current Assignment
  const currentItemsMaster = useMemo(() => {
    return itemMaster.filter(i => i.location === locationName);
  }, [itemMaster, locationName]);

  const currentAuditedItems = useMemo(() => {
    return auditedItems.filter(i => i.location === locationName);
  }, [auditedItems, locationName]);

  // 3. Calculate Current Stats (Live)
  const currentStats = useMemo(() => {
    const total = currentItemsMaster.length;
    const audited = currentAuditedItems.filter(i => i.status && i.status !== 'pending').length; 
    const discrepancies = currentAuditedItems.filter(i => i.status === 'discrepancy').length;
    const matched = currentAuditedItems.filter(i => i.status === 'matched').length;
    
    const discrepancyRate = audited > 0 ? (discrepancies / audited) * 100 : 0;
    const matchRate = audited > 0 ? (matched / audited) * 100 : 0;

    return {
      total,
      audited,
      pending: total - audited,
      discrepancies,
      matched,
      discrepancyRate,
      matchRate
    };
  }, [currentItemsMaster, currentAuditedItems]);

  // 4. Fetch Previous Assignment Data
  useEffect(() => {
    const fetchPrevious = async () => {
      if (!selectedCompanyId || !currentAssignment) return;
      
      setLoadingHistory(true);
      try {
        const history = await SupabaseDataService.getAuditHistory(selectedCompanyId);
        
        // Find the LATEST finalized report for this location that is NOT the current assignment.
        const locationReports = history.filter((r: any) => {
           // 1. Check Location Match
           const rLocName = r.locations?.name || r.report_data?.metadata?.location_name;
           const isLocationMatch = rLocName === locationName;
           
           // 2. Ensure it is NOT the current assignment
           const isNotCurrent = r.assignment_id !== currentAssignment.id;

           return isLocationMatch && isNotCurrent;
        });

        if (locationReports.length > 0) {
            setPreviousReport(locationReports[0]);
        } else {
            setPreviousReport(null);
        }

      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchPrevious();
  }, [selectedCompanyId, currentAssignment, locationName]);

  // 5. Prepare Comparison Data (Robust Recalculation)
  const comparisonData = useMemo(() => {
    const items = previousReport?.report_data?.items || [];
    
    let prevAudited = 0;
    let prevDiscrepancies = 0;
    let prevMatched = 0;
    let prevTotal = 0;

    if (items.length > 0) {
      prevTotal = items.length;
      items.forEach((item: any) => {
        // Robust check for audited status
        // Some reports might have missing status, so we check if physical_quantity is a valid number
        const hasPhysicalQty = item.physical_quantity !== undefined && item.physical_quantity !== null && item.physical_quantity !== "";
        const isAudited = (item.status && item.status !== 'pending') || hasPhysicalQty;
        
        if (isAudited) {
          prevAudited++;
          
          // Robust Match Logic:
          // 1. Explicit 'matched' status
          // 2. Variance is exactly 0 (handling string '0')
          // 3. Physical matches System explicitly
          const sys = Number(item.system_quantity || 0);
          const phy = Number(item.physical_quantity || 0);
          const variance = Number(item.variance || 0);

          if (item.status === 'matched' || variance === 0 || sys === phy) {
            prevMatched++;
          } else {
            prevDiscrepancies++;
          }
        }
      });
    } else if (previousReport?.report_data?.summary) {
      // Fallback
      const s = previousReport.report_data.summary;
      prevAudited = Number(s.auditedItems || 0);
      prevDiscrepancies = Number(s.discrepancies || 0);
      prevMatched = Number(s.matched || 0);
      prevTotal = Number(s.totalItems || 0);
    }

    const prevDiscRate = prevAudited > 0 ? (prevDiscrepancies / prevAudited) * 100 : 0;
    const prevMatchRate = prevAudited > 0 ? (prevMatched / prevAudited) * 100 : 0;

    return {
      chart: [
        {
          metric: "Discrepancy Rate",
          Previous: previousReport ? Number(prevDiscRate.toFixed(1)) : 0,
          Current: Number(currentStats.discrepancyRate.toFixed(1)),
        },
        {
          metric: "Match Rate",
          Previous: previousReport ? Number(prevMatchRate.toFixed(1)) : 0,
          Current: Number(currentStats.matchRate.toFixed(1)),
        }
      ],
      prevStats: {
        total: prevTotal,
        audited: prevAudited,
        discrepancies: prevDiscrepancies,
        matched: prevMatched
      }
    };
  }, [previousReport, currentStats]);

  // --- EXISTING GRAPHS LOGIC ---
  const categoryData = useMemo(() => {
    const categories: Record<string, { total: number; discrepant: number }> = {};
    currentAuditedItems.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (!categories[cat]) categories[cat] = { total: 0, discrepant: 0 };
      categories[cat].total += 1;
      if (item.status === 'discrepancy') categories[cat].discrepant += 1;
    });

    return Object.entries(categories)
      .map(([name, { total, discrepant }]) => ({
        name,
        rate: total > 0 ? Math.round((discrepant / total) * 100) : 0,
        total
      }))
      .filter(i => i.total > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [currentAuditedItems]);

  const auditTrendData = useMemo(() => {
    const trendMap: Record<string, number> = {};
    currentAuditedItems.forEach(item => {
      if (!item.lastAudited) return;
      try {
        const dateKey = format(parseISO(item.lastAudited), 'yyyy-MM-dd');
        trendMap[dateKey] = (trendMap[dateKey] || 0) + 1;
      } catch {}
    });
    return Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentAuditedItems]);

  const auditorPerformanceData = useMemo(() => {
    const counts: Record<string, number> = {};
    currentAuditedItems.forEach(item => {
      if (item.auditorEntries && item.auditorEntries.length > 0) {
        item.auditorEntries.forEach(entry => {
          const name = entry.auditorName || "Unknown";
          counts[name] = (counts[name] || 0) + 1;
        });
      } else if (item.status !== 'pending') {
        counts["Unknown"] = (counts["Unknown"] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [currentAuditedItems]);

  const statusData = [
    { name: "Matched", value: currentStats.matched, color: "#22c55e" },
    { name: "Discrepancies", value: currentStats.discrepancies, color: "#ef4444" },
    { name: "Pending", value: currentStats.pending, color: "#cbd5e1" },
  ];

  if (!selectedAssignmentId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[80vh] text-center space-y-4">
          <div className="bg-indigo-50 p-6 rounded-full">
            <TrendingUp className="h-12 w-12 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">No Assignment Selected</h2>
          <p className="text-gray-500 max-w-md">
            Please select an active assignment from the dashboard to view its real-time analytics and history comparison.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assignment Analytics</h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <span>{locationName}</span>
              <span>•</span>
              <span>{currentAssignment?.scheduledDate ? format(new Date(currentAssignment.scheduledDate), "MMM dd, yyyy") : "Ongoing"}</span>
          </div>
        </div>

        {/* COMPARISON SECTION */}
        {previousReport ? (
           <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50 shadow-sm">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-indigo-900">
                 <TrendingUp className="h-5 w-5" /> Current vs Previous Audit
               </CardTitle>
               <CardDescription>
                 Comparing performance against audit finalized on {format(new Date(previousReport.finalized_at), "MMM dd, yyyy")}
               </CardDescription>
             </CardHeader>
             <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={comparisonData.chart} 
                      layout="vertical"
                      barGap={8}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" unit="%" domain={[0, 100]} />
                      <YAxis dataKey="metric" type="category" width={120} tick={{fontWeight: 'bold'}} />
                      <Tooltip 
                          cursor={{fill: 'transparent'}}
                          contentStyle={{ borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="Previous" fill="#94a3b8" radius={[0, 4, 4, 0]} name="Previous Audit" />
                      <Bar 
                        dataKey="Current" 
                        fill={comparisonData.chart[0].Current < comparisonData.chart[0].Previous ? "#22c55e" : "#3b82f6"} 
                        radius={[0, 4, 4, 0]} 
                        name="Current Audit" 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Insights Summary */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                   <div className="p-3 bg-white rounded border border-indigo-100 shadow-sm flex items-center gap-3">
                      {currentStats.discrepancyRate < (comparisonData.chart[0].Previous || 0) ? (
                        <TrendingDown className="h-8 w-8 text-green-500 p-1 bg-green-50 rounded-full" />
                      ) : (
                        <TrendingUp className="h-8 w-8 text-red-500 p-1 bg-red-50 rounded-full" />
                      )}
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Error Rate Trend</p>
                        <p className="text-sm font-medium">
                           {currentStats.discrepancyRate < (comparisonData.chart[0].Previous || 0) 
                             ? "Improved (Lower errors)" 
                             : "Regressed (Higher errors)"}
                        </p>
                      </div>
                   </div>
                   <div className="p-3 bg-white rounded border border-indigo-100 shadow-sm flex items-center gap-3">
                      <Minus className="h-8 w-8 text-blue-500 p-1 bg-blue-50 rounded-full" />
                      <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">Volume Comparison</p>
                          <p className="text-sm font-medium">
                             {currentStats.total} items vs {comparisonData.prevStats.total} prev
                          </p>
                      </div>
                   </div>
                </div>
             </CardContent>
           </Card>
        ) : (
           <Alert className="bg-blue-50 border-blue-100 text-blue-800">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>First Audit</AlertTitle>
             <AlertDescription>
               No previous finalized audit history found for {locationName}. This is your baseline audit.
             </AlertDescription>
           </Alert>
        )}

        {/* MAIN ANALYTICS GRID */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Status */}
          <Card>
            <CardHeader><CardTitle>Audit Progress</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Activity Trend */}
          <Card>
            <CardHeader><CardTitle>Daily Scan Velocity</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={auditTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(t) => format(parseISO(t), 'MMM dd')} />
                  <YAxis />
                  <Tooltip labelFormatter={(t) => format(parseISO(t), 'PP')} />
                  <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Auditor Leaderboard */}
          <Card>
            <CardHeader><CardTitle>Auditor Leaderboard</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={auditorPerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Items Scanned" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Error Rate by Category */}
          <Card>
            <CardHeader><CardTitle>High Error Categories</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} interval={0} fontSize={10} />
                   <YAxis unit="%" />
                   <Tooltip formatter={(val: number) => [`${val}%`, "Error Rate"]} />
                   <Bar dataKey="rate" fill="#f97316" radius={[4, 4, 0, 0]} name="Discrepancy %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>
      </div>
    </AppLayout>
  );
};

export default Analytics;