// src/components/dashboard/PendingActionAlerts.tsx
// Fix 4.3 + 4.4 — Exception tile + pending action alerts
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
  critical: "bg-red-50 border-red-200 text-red-800",
  warning:  "bg-amber-50 border-amber-200 text-amber-800",
  info:     "bg-blue-50 border-blue-200 text-blue-800",
};

const ICON_STYLES: Record<AlertItem["severity"], string> = {
  critical: "text-red-500 bg-red-100",
  warning:  "text-amber-500 bg-amber-100",
  info:     "text-blue-500 bg-blue-100",
};

export const PendingActionAlerts = () => {
  const navigate = useNavigate();
  const { itemMaster, auditedItems, assignments } = useInventory();
  const { selectedAssignmentId, selectedCompanyId } = useCompany();

  const alerts = useMemo((): AlertItem[] => {
    const list: AlertItem[] = [];

    // ── 4.4a: Assignments awaiting sign-off ─────────────────────────────────
    const awaitingSignoff = assignments.filter(
      (a) => a.status === "submitted" && String(a.companyId) === String(selectedCompanyId)
    );
    if (awaitingSignoff.length > 0) {
      list.push({
        id: "awaiting-signoff",
        icon: <ClipboardCheck className="h-4 w-4" />,
        title: `${awaitingSignoff.length} assignment${awaitingSignoff.length > 1 ? "s" : ""} awaiting sign-off`,
        description: "Submitted reports are ready for client review and finalization.",
        action: "Review Reports",
        route: "/reports",
        severity: "warning",
      });
    }

    // ── 4.4b: Assignments with no scans yet ──────────────────────────────────
    const activeAssignments = assignments.filter(
      (a) => a.status === "active" && String(a.companyId) === String(selectedCompanyId)
    );
    const unstarted = activeAssignments.filter((a) => {
      const hasItems = itemMaster.some(
        (item) => String(item.assignmentId) === String(a.id)
      );
      const hasScans = auditedItems.some(
        (item) => String(item.assignmentId) === String(a.id) && item.status !== "pending"
      );
      return hasItems && !hasScans;
    });
    if (unstarted.length > 0) {
      list.push({
        id: "unstarted",
        icon: <Bell className="h-4 w-4" />,
        title: `${unstarted.length} active assignment${unstarted.length > 1 ? "s" : ""} with no scans yet`,
        description: "Closing stock has been uploaded but physical counting hasn't started.",
        action: "Go to Scanner",
        route: "/scanner",
        severity: "info",
      });
    }

    // ── 4.3: Discrepancy count for current assignment ────────────────────────
    if (selectedAssignmentId) {
      const discrepancies = auditedItems.filter(
        (item) =>
          String(item.assignmentId) === String(selectedAssignmentId) &&
          item.status === "discrepancy"
      );
      if (discrepancies.length > 0) {
        // Compute total value variance if unit_price data available
        let valueVariance = 0;
        let hasPricing = false;
        discrepancies.forEach((item) => {
          const price =
            Number(item.customAttributes?.unit_price || item.customAttributes?.Unit_Price || 0);
          if (price > 0) {
            hasPricing = true;
            valueVariance += (Number(item.physicalQuantity) - Number(item.systemQuantity)) * price;
          }
        });

        const valueStr = hasPricing
          ? ` • Value variance: ₹${Math.abs(valueVariance).toLocaleString("en-IN", { maximumFractionDigits: 0 })} ${valueVariance < 0 ? "short" : "excess"}`
          : "";

        list.push({
          id: "discrepancies",
          icon: <TrendingDown className="h-4 w-4" />,
          title: `${discrepancies.length} item${discrepancies.length > 1 ? "s" : ""} with discrepancies`,
          description: `Physical count differs from system quantity.${valueStr}`,
          action: "View in Reports",
          route: "/reports",
          params: "?status=discrepancy",
          severity: "critical",
        });
      }
    }

    return list;
  }, [assignments, itemMaster, auditedItems, selectedAssignmentId, selectedCompanyId]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${SEVERITY_STYLES[alert.severity]}`}
        >
          <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${ICON_STYLES[alert.severity]}`}>
            {alert.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{alert.title}</p>
            <p className="text-xs mt-0.5 opacity-80">{alert.description}</p>
          </div>
          {alert.route && (
            <button
              onClick={() => navigate(alert.route! + (alert.params || ""))}
              className="shrink-0 flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline mt-0.5"
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

// ── 4.3: Standalone exception / variance tile ─────────────────────────────────

export const ExceptionTile = () => {
  const navigate = useNavigate();
  const { auditedItems } = useInventory();
  const { selectedAssignmentId } = useCompany();

  const { discrepancyCount, valueVariance, hasPricing } = useMemo(() => {
    if (!selectedAssignmentId) return { discrepancyCount: 0, valueVariance: 0, hasPricing: false };
    const items = auditedItems.filter(
      (i) => String(i.assignmentId) === String(selectedAssignmentId) && i.status === "discrepancy"
    );
    let val = 0;
    let pricing = false;
    items.forEach((i) => {
      const price = Number(i.customAttributes?.unit_price || i.customAttributes?.Unit_Price || 0);
      if (price > 0) {
        pricing = true;
        val += (Number(i.physicalQuantity) - Number(i.systemQuantity)) * price;
      }
    });
    return { discrepancyCount: items.length, valueVariance: val, hasPricing: pricing };
  }, [auditedItems, selectedAssignmentId]);

  if (discrepancyCount === 0) return null;

  return (
    <button
      onClick={() => navigate("/reports?status=discrepancy")}
      className="w-full text-left p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-red-800">Exceptions Found</span>
        </div>
        <ArrowRight className="h-4 w-4 text-red-400 group-hover:translate-x-1 transition-transform" />
      </div>
      <div className="text-2xl font-bold text-red-900">
        {discrepancyCount}
        <span className="text-sm font-normal text-red-600 ml-1">discrepant items</span>
      </div>
      {hasPricing && (
        <div className="text-xs text-red-600 mt-1">
          Value variance: ₹{Math.abs(valueVariance).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          {" "}
          <span className="opacity-70">
            {valueVariance < 0 ? "(shortage)" : "(overage)"}
          </span>
        </div>
      )}
      <div className="text-xs text-red-400 mt-1.5">Tap to view in Reports →</div>
    </button>
  );
};