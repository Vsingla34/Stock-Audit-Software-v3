import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
} 

export const StatCard = ({
  title, value, description, icon, className, valueClassName
}: StatCardProps) => {
  return (
    <Card className={cn("overflow-hidden rounded-xl shadow-sm border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all duration-300 group", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-100">
        <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-700 transition-colors">{title}</CardTitle>
        {icon && <div className="text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-300">{icon}</div>}
      </CardHeader>
      <CardContent className="pt-4">
        <div className={cn("text-2xl font-black tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors", valueClassName)}>{value}</div>
        {description && (
          <p className="text-xs font-semibold text-slate-500 mt-1.5">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};