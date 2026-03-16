import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext"; // 🔥 FIX: Added missing import
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
import { AlertCircle, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Analytics = () => {
  const { auditedItems, itemMaster, assignments, locations } = useInventory();
  const { selectedAssignmentId, selectedCompanyId } = useCompany();
  const { currentUser } = useUser(); // 🔥 FIX: Pulled currentUser from context
  
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

  // 3. Calculate Current Stats (Quantity-Based)
  const currentStats = useMemo(() => {
    let expectedQty = 0;
    let foundQty = 0;
    let matchedQty = 0;
    let varianceQty = 0;
    let pendingQty = 0;

    currentItemsMaster.forEach(item => {
      const sq = Number(item.systemQuantity) || 0;
      expectedQty += sq;
      
      if (!item.status || item.status === 'pending') {
        pendingQty += sq;
      }
    });

    currentAuditedItems.forEach(item => {
      const pq = Number(item.physicalQuantity) || 0;
      const sq = Number(item.systemQuantity) || 0;
      foundQty += pq;

      if (item.status === 'matched' || (item.status !== 'pending' && pq === sq)) {
        matchedQty += pq;
      } else if (item.status === 'discrepancy') {
        varianceQty += Math.abs(pq - sq);
      }
    });

    const discrepancyRate = foundQty > 0 ? (varianceQty / foundQty) * 100 : 0;
    const matchRate = foundQty > 0 ? (matchedQty / foundQty) * 100 : 0;

    return {
      expectedQty,
      foundQty,
      pendingQty,
      varianceQty,
      matchedQty,
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
        
        const locationReports = history.filter((r: any) => {
           const rLocName = r.locations?.name || r.report_data?.metadata?.location_name;
           const isLocationMatch = rLocName === locationName;
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

  // 5. Prepare Comparison Data (Quantity-Based)
  const comparisonData = useMemo(() => {
    const items = previousReport?.report_data?.items || [];
    
    let prevFoundQty = 0;
    let prevMatchedQty = 0;
    let prevVarianceQty = 0;

    if (items.length > 0) {
      items.forEach((item: any) => {
        const hasPhysicalQty = item.physical_quantity !== undefined && item.physical_quantity !== null && item.physical_quantity !== "";
        const isAudited = (item.status && item.status !== 'pending') || hasPhysicalQty;
        
        if (isAudited) {
          const sq = Number(item.system_quantity || 0);
          const pq = Number(item.physical_quantity || 0);
          const variance = Math.abs(pq - sq);
          
          prevFoundQty += pq;

          if (item.status === 'matched' || variance === 0 || sq === pq) {
            prevMatchedQty += pq;
          } else {
            prevVarianceQty += variance;
          }
        }
      });
    } else if (previousReport?.report_data?.summary) {
      const s = previousReport.report_data.summary;
      prevFoundQty = Number(s.totalPhysicalQty || 0);
      prevVarianceQty = Number(s.discrepancies || 0); // Not exact qty, but fallback
    }

    const prevDiscRate = prevFoundQty > 0 ? (prevVarianceQty / prevFoundQty) * 100 : 0;
    const prevMatchRate = prevFoundQty > 0 ? (prevMatchedQty / prevFoundQty) * 100 : 0;

    return {
      chart: [
        {
          metric: "Discrepancy Rate (Qty)",
          Previous: previousReport ? Number(prevDiscRate.toFixed(1)) : 0,
          Current: Number(currentStats.discrepancyRate.toFixed(1)),
        },
        {
          metric: "Match Rate (Qty)",
          Previous: previousReport ? Number(prevMatchRate.toFixed(1)) : 0,
          Current: Number(currentStats.matchRate.toFixed(1)),
        }
      ],
      prevStats: {
        foundQty: prevFoundQty,
      }
    };
  }, [previousReport, currentStats]);

  // --- QUANTITY BASED GRAPHS LOGIC ---
  
  const categoryData = useMemo(() => {
    const categories: Record<string, { expectedQty: number; varianceQty: number }> = {};
    currentAuditedItems.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (!categories[cat]) categories[cat] = { expectedQty: 0, varianceQty: 0 };
      
      const sq = Number(item.systemQuantity) || 0;
      const pq = Number(item.physicalQuantity) || 0;
      
      categories[cat].expectedQty += sq;
      if (item.status === 'discrepancy') {
          categories[cat].varianceQty += Math.abs(pq - sq);
      }
    });

    return Object.entries(categories)
      .map(([name, { expectedQty, varianceQty }]) => ({
        name,
        rate: expectedQty > 0 ? Math.round((varianceQty / expectedQty) * 100) : (varianceQty > 0 ? 100 : 0),
        totalQty: expectedQty
      }))
      .filter(i => i.totalQty > 0 || i.rate > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [currentAuditedItems]);

  const auditTrendData = useMemo(() => {
    const trendMap: Record<string, number> = {};
    currentAuditedItems.forEach(item => {
      if (item.auditorEntries && item.auditorEntries.length > 0) {
          item.auditorEntries.forEach(entry => {
              if (entry.auditedAt) {
                  try {
                      const dateKey = format(parseISO(entry.auditedAt), 'yyyy-MM-dd');
                      trendMap[dateKey] = (trendMap[dateKey] || 0) + (Number(entry.quantityFound) || 0);
                  } catch {}
              }
          });
      }
    });
    return Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentAuditedItems]);

  // Master array of all auditor quantities
  const allAuditorPerformanceData = useMemo(() => {
    const counts: Record<string, number> = {};
    currentAuditedItems.forEach(item => {
      if (item.auditorEntries && item.auditorEntries.length > 0) {
        item.auditorEntries.forEach(entry => {
          const name = entry.auditorName || "Unknown";
          counts[name] = (counts[name] || 0) + (Number(entry.quantityFound) || 0);
        });
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [currentAuditedItems]);

  // Sliced array for the bar chart
  const topAuditorsChartData = useMemo(() => allAuditorPerformanceData.slice(0, 10), [allAuditorPerformanceData]);

  const statusData = [
    { name: "Matched Qty", value: currentStats.matchedQty, color: "#22c55e" },
    { name: "Variance Qty", value: currentStats.varianceQty, color: "#ef4444" },
    { name: "Pending Expected Qty", value: currentStats.pendingQty, color: "#cbd5e1" },
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Volume Analytics</h1>
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
                 <TrendingUp className="h-5 w-5" /> Current vs Previous Audit (By Quantity)
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
                      <YAxis dataKey="metric" type="category" width={150} tick={{fontWeight: 'bold'}} />
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
                             {currentStats.foundQty} Qty vs {comparisonData.prevStats.foundQty} Qty prev
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
            <CardHeader><CardTitle>Audit Progress (By Quantity)</CardTitle></CardHeader>
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
                  <Tooltip formatter={(val: number) => [val, "Quantity"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Activity Trend */}
          <Card>
            <CardHeader><CardTitle>Daily Scan Velocity (Quantity)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={auditTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(t) => format(parseISO(t), 'MMM dd')} />
                  <YAxis />
                  <Tooltip labelFormatter={(t) => format(parseISO(t), 'PP')} formatter={(val: number) => [val, "Qty Scanned"]} />
                  <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Auditor Leaderboard */}
          <Card>
            <CardHeader><CardTitle>Top 10 Auditors</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAuditorsChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={110} tick={{fontSize: 12}} />
                  <Tooltip formatter={(val: number) => [val, "Qty Found"]} />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Quantity Found" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Error Rate by Category */}
          <Card>
            <CardHeader><CardTitle>High Error Categories (By Qty Variance)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} interval={0} fontSize={10} />
                   <YAxis unit="%" />
                   <Tooltip formatter={(val: number) => [`${val}%`, "Variance Rate"]} />
                   <Bar dataKey="rate" fill="#f97316" radius={[4, 4, 0, 0]} name="Variance %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>

        {/* 🔥 NEW: FULL AUDITOR BREAKDOWN TABLE */}
        <Card className="border-gray-200 shadow-sm mt-6 mb-20">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Users className="h-5 w-5 text-indigo-600" />
              Auditor Scan Summary
            </CardTitle>
            <CardDescription>Total physical quantity collected by every auditor during this assignment.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Auditor Account / Email</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Total Quantity Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAuditorPerformanceData.length > 0 ? (
                  allAuditorPerformanceData.map((auditor, index) => (
                    <TableRow key={index} className="hover:bg-indigo-50/30 transition-colors">
                      <TableCell className="font-medium text-gray-900">
                        {auditor.name}
                        {auditor.name === currentUser?.email && (
                           <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold tracking-wide uppercase">You</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-700 text-base">
                        {auditor.count.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-gray-500">
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