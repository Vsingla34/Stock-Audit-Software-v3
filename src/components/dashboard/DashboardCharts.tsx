// src/components/dashboard/DashboardCharts.tsx
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

const StatusDonut = ({ items }: { items: ChartItem[] }) => {
  const data = useMemo(() => {
    const counts = { matched: 0, discrepancy: 0, pending: 0 };
    items.forEach((i) => {
      const s = (i.status || "pending") as keyof typeof counts;
      if (s in counts) counts[s]++;
    });
    return [
      { name: "Matched",     value: counts.matched,     color: "#10b981" }, // Emerald 500
      { name: "Discrepancy", value: counts.discrepancy, color: "#f43f5e" }, // Rose 500
      { name: "Pending",     value: counts.pending,     color: "#94a3b8" }, // Slate 400
    ].filter((d) => d.value > 0);
  }, [items]);

  const total = items.length;

  return (
    <Card className="shadow-sm border border-slate-200 bg-white rounded-xl transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-2 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800">
          SKU Status Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {total === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-medium">
            No items yet
          </div>
        ) : (
          <div className="relative group">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} className="transition-all duration-300 hover:opacity-80 cursor-pointer" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} SKUs (${Math.round((value / total) * 100)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontSize: 12,
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                  }}
                  itemStyle={{ color: "#334155" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-transform duration-300 group-hover:scale-105">
              <span className="text-2xl font-black tracking-tight text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Total SKUs</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5 mt-5 pt-4 border-t border-slate-100">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-xs group/item cursor-default">
              <span className="flex items-center gap-2 text-slate-500 font-medium transition-colors group-hover/item:text-slate-800">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ background: d.color }}
                />
                {d.name}
              </span>
              <span className="font-semibold text-slate-800">
                {d.value}{" "}
                <span className="text-slate-400 font-medium ml-1">
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
    <Card className="shadow-sm border border-slate-200 bg-white rounded-xl transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-2 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800">
          Category Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-medium">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={data}
              margin={{ top: 0, right: 8, left: -25, bottom: 0 }}
              barSize={10}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                dx={-10}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  fontSize: 12,
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                }}
              />
              <Bar
                dataKey="matched"
                name="Matched"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="discrepancy"
                name="Discrepancy"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-5 mt-5 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-2 cursor-default">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Matched
          </span>
          <span className="flex items-center gap-2 cursor-default">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            Discrepancy
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export const DashboardCharts = ({ items }: DashboardChartsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <StatusDonut items={items} />
    <CategoryDiscrepancyBar items={items} />
  </div>
);