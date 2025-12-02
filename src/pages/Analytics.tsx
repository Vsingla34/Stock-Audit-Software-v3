import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  PieChart,
  LineChart,
  Cell,
  Bar,
  Pie,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";

const Analytics = () => {
  const { auditedItems, itemMaster, getInventorySummary } = useInventory();
  const summary = getInventorySummary();

  // 1. Existing: Category Progress Data
  const categoryData = useMemo(() => {
    const categories: Record<string, { name: string, total: number, audited: number }> = {};
    
    itemMaster.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (!categories[cat]) {
        categories[cat] = {
          name: cat,
          total: 0,
          audited: 0
        };
      }
      categories[cat].total += 1;
    });
    
    auditedItems.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (categories[cat]) {
        categories[cat].audited += 1;
      }
    });
    
    return Object.values(categories);
  }, [itemMaster, auditedItems]);

  // 2. Existing: Status Data
  const statusData = useMemo(() => [
    { name: "Matched", value: summary.matched, color: "#22c55e" },       // Green-500
    { name: "Discrepancies", value: summary.discrepancies, color: "#ef4444" }, // Red-500
    { name: "Pending", value: summary.pendingItems, color: "#cbd5e1" },  // Slate-300
  ], [summary]);

  // 3. Existing: Location Data
  const locationData = useMemo(() => {
    const locations: Record<string, { name: string, system: number, physical: number }> = {};
    
    itemMaster.forEach(item => {
      if (!locations[item.location]) {
        locations[item.location] = {
          name: item.location,
          system: 0,
          physical: 0
        };
      }
      locations[item.location].system += item.systemQuantity;
    });
    
    auditedItems.forEach(item => {
      if (locations[item.location]) {
        locations[item.location].physical += (item.physicalQuantity || 0);
      }
    });
    
    return Object.values(locations);
  }, [itemMaster, auditedItems]);

  // 4. Existing: Audit Activity Trend (Daily Speed)
  const auditTrendData = useMemo(() => {
    const trendMap: Record<string, number> = {};

    auditedItems.forEach(item => {
      if (!item.lastAudited) return;
      try {
        const dateKey = format(parseISO(item.lastAudited), 'yyyy-MM-dd');
        trendMap[dateKey] = (trendMap[dateKey] || 0) + 1;
      } catch (e) {
        // Ignore invalid dates
      }
    });

    return Object.entries(trendMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [auditedItems]);

  // 5. Existing: Top Discrepancies (Absolute Variance)
  const topDiscrepanciesData = useMemo(() => {
    const discrepancies = auditedItems
      .filter(item => {
         const variance = Math.abs((item.physicalQuantity || 0) - item.systemQuantity);
         return variance > 0;
      })
      .map(item => ({
        name: item.name || item.sku,
        variance: Math.abs((item.physicalQuantity || 0) - item.systemQuantity),
      }));

    return discrepancies
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 5);
  }, [auditedItems]);

  // 6. NEW: Auditor Performance Leaderboard
  const auditorPerformanceData = useMemo(() => {
    const counts: Record<string, number> = {};

    auditedItems.forEach(item => {
      if (item.auditorEntries && item.auditorEntries.length > 0) {
        // Count unique items touched by each auditor
        item.auditorEntries.forEach(entry => {
          const name = entry.auditorName || "Unknown";
          counts[name] = (counts[name] || 0) + 1;
        });
      } else if (item.status !== 'pending') {
        // Fallback for items without explicit entries but are audited
        counts["Unknown"] = (counts["Unknown"] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 auditors
  }, [auditedItems]);

  // 7. NEW: Discrepancy Rate by Category
  const categoryDiscrepancyRateData = useMemo(() => {
    const stats: Record<string, { total: number; discrepant: number }> = {};

    auditedItems.forEach(item => {
      const cat = item.category || "Uncategorized";
      if (!stats[cat]) {
        stats[cat] = { total: 0, discrepant: 0 };
      }
      stats[cat].total += 1;
      if (item.status === 'discrepancy') {
        stats[cat].discrepant += 1;
      }
    });

    return Object.entries(stats)
      .map(([name, { total, discrepant }]) => ({
        name,
        rate: total > 0 ? Math.round((discrepant / total) * 100) : 0,
        total // keeping total for tooltip context
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [auditedItems]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Analytics</h1>
          <p className="text-muted-foreground">Visual insights into your inventory audit</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* 1. Audit Status */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Audit Status Overview</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 2. Audit Activity Trend */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Daily Audit Activity</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {auditTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={auditTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(str) => {
                        try { return format(parseISO(str), 'MMM dd'); } catch { return str; }
                      }}
                    />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(label) => {
                        try { return format(parseISO(label), 'MMMM dd, yyyy'); } catch { return label; }
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      name="Items Audited" 
                      stroke="#8b5cf6" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: "#8b5cf6" }} 
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Not enough data to display trend
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Auditor Performance (NEW) */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Auditor Performance (Items Scanned)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {auditorPerformanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={auditorPerformanceData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" name="Items Scanned" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No auditor data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Discrepancy Rate by Category (NEW) */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Error Rate by Category</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {categoryDiscrepancyRateData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryDiscrepancyRateData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      unit="%" 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number, name: string, props: any) => {
                        return [`${value}% (${props.payload.total} items)`, "Error Rate"];
                      }}
                    />
                    <Bar dataKey="rate" name="Discrepancy Rate %" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No discrepancy data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Top Discrepancies */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Top 5 Discrepancies (Absolute Variance)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {topDiscrepanciesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDiscrepanciesData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={120} 
                      stroke="#64748b" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => value.length > 18 ? `${value.substring(0, 18)}...` : value}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="variance" name="Abs Variance" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No discrepancies found
                </div>
              )}
            </CardContent>
          </Card>

          {/* 6. Inventory by Location */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Inventory by Location</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="system" name="System Qty" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="physical" name="Physical Qty" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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