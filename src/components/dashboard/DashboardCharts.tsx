// src/components/dashboard/DashboardCharts.tsx
// Fix 4.1 — Charts on the main dashboard
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_CONFIG } from "@/lib/statusConfig";

interface ChartItem {
  status?: string;
  systemQuantity?: number;
  physicalQuantity?: number;
  variance?: number;
  category?: string;
  customAttributes?: Record<string, any>;
}

interface DashboardChartsProps {
  items: ChartItem[];
}

// ── Donut chart: SKU count by status ─────────────────────────────────────────

const StatusDonut = ({ items }: { items: ChartItem[] }) => {
  const data = useMemo(() => {
    const counts = { matched: 0, discrepancy: 0, pending: 0 };
    items.forEach((i) => {
      const s = (i.status || "pending") as keyof typeof counts;
      if (s in counts) counts[s]++;
    });
    return [
      { name: "Matched",     value: counts.matched,     color: STATUS_CONFIG.matched.chartColor },
      { name: "Discrepancy", value: counts.discrepancy, color: STATUS_CONFIG.discrepancy.chartColor },
      { name: "Pending",     value: counts.pending,     color: STATUS_CONFIG.pending.chartColor },
    ].filter((d) => d.value > 0);
  }, [items]);

  const total = items.length;

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">
          SKU Status Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            No items yet
          </div>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} SKUs (${Math.round((value / total) * 100)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900">{total}</span>
              <span className="text-xs text-gray-500">Total SKUs</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-col gap-1.5 mt-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: d.color }}
                />
                {d.name}
              </span>
              <span className="font-medium text-gray-800">
                {d.value}{" "}
                <span className="text-gray-400 font-normal">
                  ({Math.round((d.value / total) * 100)}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Bar chart: top discrepancies by category ──────────────────────────────────

const CategoryDiscrepancyBar = ({ items }: { items: ChartItem[] }) => {
  const data = useMemo(() => {
    const map = new Map<string, { matched: number; discrepancy: number }>();
    items.forEach((i) => {
      const cat = i.category || "Uncategorised";
      if (!map.has(cat)) map.set(cat, { matched: 0, discrepancy: 0 });
      const entry = map.get(cat)!;
      if (i.status === "matched")      entry.matched++;
      if (i.status === "discrepancy")  entry.discrepancy++;
    });
    return Array.from(map.entries())
      .map(([category, v]) => ({ category: category.slice(0, 12), ...v }))
      .sort((a, b) => b.discrepancy - a.discrepancy)
      .slice(0, 6);
  }, [items]);

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">
          Category Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={data}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              barSize={10}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="matched"
                name="Matched"
                fill={STATUS_CONFIG.matched.chartColor}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="discrepancy"
                name="Discrepancy"
                fill={STATUS_CONFIG.discrepancy.chartColor}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            Matched
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Discrepancy
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Exported combined component ───────────────────────────────────────────────

export const DashboardCharts = ({ items }: DashboardChartsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <StatusDonut items={items} />
    <CategoryDiscrepancyBar items={items} />
  </div>
);