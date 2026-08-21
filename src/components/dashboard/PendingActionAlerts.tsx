// src/components/dashboard/PendingActionAlerts.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, TrendingDown, Bell, ArrowRight } from "lucide-react";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";

interface AlertItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
  route?: string;
  params?: string;
  severity: "critical" | "warning" | "info";
}

const SEVERITY_STYLES: Record<AlertItem["severity"], string> = {
  critical: "bg-white border-rose-200 text-rose-900",
  warning:  "bg-white border-amber-200 text-amber-900",
  info:     "bg-white border-blue-200 text-blue-900",
};

const ICON_STYLES: Record<AlertItem["severity"], string> = {
  critical: "text-rose-600 bg-rose-50 border border-rose-100",
  warning:  "text-amber-600 bg-amber-50 border border-amber-100",
  info:     "text-blue-600 bg-blue-50 border border-blue-100",
};

export const PendingActionAlerts = () => {
  const navigate = useNavigate();
  const { itemMaster, auditedItems, assignments } = useInventory();
  const { selectedAssignmentId, selectedCompanyId } = useCompany();

  const alerts = useMemo((): AlertItem[] => {
    const list: AlertItem[] = [];

    const awaitingSignoff = assignments.filter((a) => a.status === "submitted" && String(a.companyId) === String(selectedCompanyId));
    if (awaitingSignoff.length > 0) {
      list.push({
        id: "awaiting-signoff", icon: <ClipboardCheck className="h-4 w-4" />,
        title: `${awaitingSignoff.length} assignment${awaitingSignoff.length > 1 ? "s" : ""} awaiting sign-off`,
        description: "Submitted reports are ready for client review and finalization.",
        action: "Review Reports", route: "/reports", severity: "warning",
      });
    }

    const activeAssignments = assignments.filter((a) => a.status === "active" && String(a.companyId) === String(selectedCompanyId));
    const unstarted = activeAssignments.filter((a) => {
      const hasItems = itemMaster.some((item) => String(item.assignmentId) === String(a.id));
      const hasScans = auditedItems.some((item) => String(item.assignmentId) === String(a.id) && item.status !== "pending");
      return hasItems && !hasScans;
    });
    if (unstarted.length > 0) {
      list.push({
        id: "unstarted", icon: <Bell className="h-4 w-4" />,
        title: `${unstarted.length} active assignment${unstarted.length > 1 ? "s" : ""} with no scans yet`,
        description: "Closing stock has been uploaded but physical counting hasn't started.",
        action: "Go to Scanner", route: "/scanner", severity: "info",
      });
    }

    if (selectedAssignmentId) {
      const discrepancies = auditedItems.filter((item) => String(item.assignmentId) === String(selectedAssignmentId) && item.status === "discrepancy");
      if (discrepancies.length > 0) {
        let valueVariance = 0, hasPricing = false;
        discrepancies.forEach((item) => {
          const price = Number(item.customAttributes?.unit_price || item.customAttributes?.Unit_Price || 0);
          if (price > 0) { hasPricing = true; valueVariance += (Number(item.physicalQuantity) - Number(item.systemQuantity)) * price; }
        });
        const valueStr = hasPricing ? ` • Value variance: ₹${Math.abs(valueVariance).toLocaleString("en-IN", { maximumFractionDigits: 0 })} ${valueVariance < 0 ? "short" : "excess"}` : "";
        list.push({
          id: "discrepancies", icon: <TrendingDown className="h-4 w-4" />,
          title: `${discrepancies.length} item${discrepancies.length > 1 ? "s" : ""} with discrepancies`,
          description: `Physical count differs from system quantity.${valueStr}`,
          action: "View in Reports", route: "/reports", params: "?status=discrepancy", severity: "critical",
        });
      }
    }
    return list;
  }, [assignments, itemMaster, auditedItems, selectedAssignmentId, selectedCompanyId]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className={`flex items-start gap-4 rounded-xl border px-4 py-3.5 shadow-sm transition-all duration-300 hover:shadow-md ${SEVERITY_STYLES[alert.severity]} group`}>
          <div className={`p-2 rounded-lg shrink-0 ${ICON_STYLES[alert.severity]} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
            {alert.icon}
          </div>
          <div className="flex-1 min-w-0 mt-0.5">
            <p className="text-[14px] font-bold tracking-tight">{alert.title}</p>
            <p className="text-xs mt-1 font-medium opacity-80 leading-relaxed text-slate-600">{alert.description}</p>
          </div>
          {alert.route && (
            <button
              onClick={() => navigate(alert.route! + (alert.params || ""))}
              className="shrink-0 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider mt-1 border border-current/20 px-3 py-1.5 rounded bg-white hover:bg-slate-50 transition-colors active:scale-95"
            >
              {alert.action}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export const ExceptionTile = () => {
  const navigate = useNavigate();
  const { auditedItems } = useInventory();
  const { selectedAssignmentId } = useCompany();

  const { discrepancyCount, valueVariance, hasPricing } = useMemo(() => {
    if (!selectedAssignmentId) return { discrepancyCount: 0, valueVariance: 0, hasPricing: false };
    const items = auditedItems.filter((i) => String(i.assignmentId) === String(selectedAssignmentId) && i.status === "discrepancy");
    let val = 0, pricing = false;
    items.forEach((i) => {
      const price = Number(i.customAttributes?.unit_price || i.customAttributes?.Unit_Price || 0);
      if (price > 0) { pricing = true; val += (Number(i.physicalQuantity) - Number(i.systemQuantity)) * price; }
    });
    return { discrepancyCount: items.length, valueVariance: val, hasPricing: pricing };
  }, [auditedItems, selectedAssignmentId]);

  if (discrepancyCount === 0) return null;

  return (
    <button
      onClick={() => navigate("/reports?status=discrepancy")}
      className="w-full text-left p-6 bg-white border border-rose-200 rounded-xl hover:border-rose-300 hover:bg-rose-50 shadow-sm hover:shadow-md transition-all duration-300 group outline-none active:scale-[0.98]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 group-hover:scale-110 transition-transform duration-300">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <span className="text-[12px] font-bold text-rose-600 uppercase tracking-widest">Exceptions Found</span>
        </div>
        <div className="p-1.5 rounded-full bg-rose-50 text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors">
          <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
      <div className="text-4xl font-black tracking-tight text-slate-900 mt-2">
        {discrepancyCount}
        <span className="text-sm font-semibold text-rose-600/80 ml-2 uppercase tracking-widest">Items</span>
      </div>
      {hasPricing && (
        <div className="text-[13px] font-semibold text-rose-700 mt-4 bg-white inline-block px-3 py-1.5 rounded-md border border-rose-100 shadow-sm">
          Value variance: ₹{Math.abs(valueVariance).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          {" "}
          <span className="text-rose-500 font-medium">
            {valueVariance < 0 ? "(shortage)" : "(overage)"}
          </span>
        </div>
      )}
    </button>
  );
};