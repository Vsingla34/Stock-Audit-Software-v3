// src/pages/Index.tsx
import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { InventoryOverview } from "@/components/dashboard/InventoryOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { PendingActionAlerts, ExceptionTile } from "@/components/dashboard/PendingActionAlerts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Barcode, Search, ClipboardList, Upload, FileSpreadsheet,
  BarChart3, Users, MapPin, ScanBarcode, AlertTriangle,
  CheckCircle2, Clock,
} from "lucide-react";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import { useInventory } from "@/context/InventoryContext";
import { supabase } from "@/integrations/supabase/client";

// ── Dynamic Text Scaler for Admin/Auditor Cards ─────────────────────────────
const AutoScaledValue = ({ value, prefix = "", className = "" }: { value: string | number, prefix?: string, className?: string }) => {
  const str = prefix + String(value);
  const len = str.length;
  
  let sizeClass = "text-3xl";
  if (len >= 12) sizeClass = "text-xl";
  else if (len >= 9) sizeClass = "text-2xl";

  return (
    <div className={`${sizeClass} font-black tracking-tight truncate w-full ${className}`} title={str}>
      {str}
    </div>
  );
};

const QuickActionSkeleton = () => (
  <div className="grid gap-4 grid-cols-2">
    {[1, 2, 3, 4].map((i) => (
      <Skeleton key={i} className="h-28 w-full rounded-xl bg-slate-100 border border-slate-200" />
    ))}
  </div>
);

const RoleBadge = ({ role }: { role: string }) => {
  const config: Record<string, string> = {
    super_admin: "text-purple-700 border-purple-200 bg-purple-50",
    admin:       "text-blue-700 border-blue-200 bg-blue-50",
    auditor:     "text-emerald-700 border-emerald-200 bg-emerald-50",
    client:      "text-amber-700 border-amber-200 bg-amber-50",
  };
  const label: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", auditor: "Auditor", client: "Client" };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${config[role] || "bg-slate-100 text-slate-700 border-slate-200"} whitespace-nowrap`}>
      {label[role] || role}
    </span>
  );
};

const AuditorDashboard = ({ assignmentId }: { assignmentId: string | null }) => {
  const { itemMaster, auditedItems } = useInventory();

  const stats = useMemo(() => {
    if (!assignmentId) return null;
    const total    = itemMaster.filter(i => String(i.assignmentId) === String(assignmentId)).length;
    const scanned  = auditedItems.filter(i => String(i.assignmentId) === String(assignmentId) && i.status !== "pending").length;
    const pending  = total - scanned;
    const pct      = total > 0 ? Math.round((scanned / total) * 100) : 0;
    return { total, scanned, pending, pct };
  }, [itemMaster, auditedItems, assignmentId]);

  if (!assignmentId || !stats) return (
    <Card className="shadow-sm border border-amber-200 bg-amber-50 rounded-xl">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-2 bg-white border border-amber-100 rounded-lg shadow-sm shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-amber-900 tracking-tight truncate">No active assignment</p>
          <p className="text-[12px] font-medium text-amber-700 mt-0.5 truncate">Contact your admin to be assigned to a location.</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 text-center transition-all duration-300 hover:border-slate-300 hover:shadow-md overflow-hidden">
        <AutoScaledValue value={stats.total} className="text-slate-900" />
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 truncate">Total SKUs</div>
      </div>
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 text-center transition-all duration-300 hover:border-slate-300 hover:shadow-md overflow-hidden">
        <AutoScaledValue value={stats.scanned} className="text-emerald-600" />
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 truncate">Scanned</div>
      </div>
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 text-center transition-all duration-300 hover:border-slate-300 hover:shadow-md overflow-hidden">
        <AutoScaledValue value={stats.pending} className="text-slate-900" />
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 truncate">Remaining</div>
      </div>

      <div className="col-span-3 mt-3 p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
        <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
          <span className="truncate">Your progress today</span>
          <span className="text-blue-600 shrink-0 pl-2">{stats.pct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-1000"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const AdminStatsRow = () => {
  const { assignments, locations } = useInventory();
  const { selectedCompanyId } = useCompany();

  const stats = useMemo(() => {
    const companyAssignments = assignments.filter((a) => String(a.companyId) === String(selectedCompanyId));
    return {
      total: companyAssignments.length, active: companyAssignments.filter((a) => a.status === "active").length,
      submitted: companyAssignments.filter((a) => a.status === "submitted").length,
      finalized: companyAssignments.filter((a) => a.status === "finalized").length,
      locations: locations.filter((l) => String(l.companyId) === String(selectedCompanyId)).length,
    };
  }, [assignments, locations, selectedCompanyId]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: "Active Audits",   value: stats.active,    icon: <ScanBarcode className="h-4 w-4" />, color: "blue" },
        { label: "Awaiting Review", value: stats.submitted, icon: <Clock className="h-4 w-4" />,       color: "amber"  },
        { label: "Finalized",       value: stats.finalized, icon: <CheckCircle2 className="h-4 w-4" />, color: "emerald" },
        { label: "Locations",       value: stats.locations, icon: <MapPin className="h-4 w-4" />,      color: "indigo"  },
      ].map((s) => (
        <div key={s.label} className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-300 group cursor-default overflow-hidden">
          <div className={`text-${s.color}-600 mb-4 p-2 bg-${s.color}-50 border border-${s.color}-100 rounded-lg inline-block group-hover:scale-110 transition-transform duration-300`}>{s.icon}</div>
          <AutoScaledValue value={s.value} className="text-slate-900 group-hover:text-blue-700 transition-colors" />
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 truncate" title={s.label}>{s.label}</div>
        </div>
      ))}
    </div>
  );
};

const ClientDashboard = () => {
  const { assignments } = useInventory();
  const { selectedCompanyId } = useCompany();
  const relevant = useMemo(() => assignments.filter((a) => String(a.companyId) === String(selectedCompanyId)).sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).slice(0, 3), [assignments, selectedCompanyId]);

  if (relevant.length === 0) return (
    <div className="text-center py-8 text-slate-500 text-[13px] font-bold uppercase tracking-widest border border-dashed border-slate-300 rounded-xl bg-slate-50">
      No audit assignments yet
    </div>
  );

  const statusLabel: Record<string, { label: string; cls: string }> = {
    active:    { label: "In Progress", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    submitted: { label: "Awaiting Sign-off", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    finalized: { label: "Finalized", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    pending:   { label: "Not Started", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  };

  return (
    <div className="space-y-3">
      {relevant.map((a) => {
        const s = statusLabel[a.status] || statusLabel.pending;
        return (
          <div key={a.id} className="flex items-center justify-between p-4 bg-white shadow-sm rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-300 gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 tracking-tight truncate">Assignment #{a.id}</p>
              <p className="text-[12px] font-medium text-slate-500 mt-1 truncate">
                {new Date(a.scheduledDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border shrink-0 whitespace-nowrap ${s.cls}`}>
              {s.label}
            </span>
          </div>
        );
      })}
      <Link to="/reports" className="block text-center text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 hover:underline pt-3 transition-colors">
        View all reports →
      </Link>
    </div>
  );
};

const EmptyDashboardState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center gap-5 bg-white shadow-sm border border-slate-200 rounded-xl px-4">
    <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl shrink-0">
      <BarChart3 className="h-10 w-10 text-blue-600" />
    </div>
    <div>
      <p className="font-black text-slate-900 text-[18px] tracking-tight">No data yet</p>
      <p className="text-[13px] font-medium text-slate-500 mt-2 max-w-sm leading-relaxed mx-auto">
        Upload your closing stock and start an assignment to see the dashboard.
      </p>
    </div>
    <div className="flex gap-4 flex-wrap justify-center mt-4 w-full sm:w-auto">
      <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white rounded-md h-10 px-5 text-[13px] font-bold tracking-wide shadow-sm transition-all active:scale-95 w-full sm:w-auto">
        <Link to="/upload"><Upload className="h-4 w-4 mr-2" />Upload Stock</Link>
      </Button>
      <Button asChild variant="outline" className="bg-white rounded-md border-slate-200 h-10 px-5 text-[13px] font-bold tracking-wide text-slate-700 hover:bg-slate-50 hover:text-blue-700 shadow-sm transition-all active:scale-95 w-full sm:w-auto">
        <Link to="/assignments"><ClipboardList className="h-4 w-4 mr-2" />Manage Assignments</Link>
      </Button>
    </div>
  </div>
);

const Index = () => {
  const { canUploadData, canPerformAudits, isClientUser, isSuperAdmin, isAdmin, isAuditor } = useUserAccess();
  const { currentUser } = useUser();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const { itemMaster, auditedItems, isLoading } = useInventory();
  const [companyName, setCompanyName] = useState("");

  const role = currentUser?.role || "auditor";
  const isAdminUser   = isSuperAdmin() || isAdmin();
  const isAuditorUser = isAuditor();
  const isClientUser_ = isClientUser();

  useEffect(() => {
    if (!selectedCompanyId) return;
    supabase.from("companies").select("name").eq("id", selectedCompanyId).single()
      .then(({ data }) => { if (data?.name) setCompanyName(data.name); }).catch(() => {});
  }, [selectedCompanyId]);

  const currentItems = useMemo(() => {
    if (!selectedAssignmentId) return [];
    return itemMaster
      .map((m) => { const a = auditedItems.find((ai) => ai.id === m.id); return a || m; })
      .filter((i) => String(i.assignmentId) === String(selectedAssignmentId));
  }, [itemMaster, auditedItems, selectedAssignmentId]);

  const hasData = currentItems.length > 0;

  return (
    <AppLayout>
      <div className="space-y-8 w-full max-w-full overflow-x-hidden min-h-screen">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 truncate">
                Welcome, <span className="text-blue-600">{currentUser?.name || "User"}</span>
              </h1>
              <RoleBadge role={role} />
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500">Dashboard Overview</p>
          </div>
          <div className="text-left md:text-right p-3 bg-white shadow-sm border border-slate-200 rounded-xl shrink-0 max-w-full md:max-w-xs">
            {companyName && (
              <h2 className="text-[14px] font-bold text-slate-900 tracking-tight flex items-center gap-2 md:justify-end truncate" title={companyName}>
                <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{companyName}</span>
              </h2>
            )}
            {selectedAssignmentId && (
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2 truncate">
                Assignment <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 ml-1">#{selectedAssignmentId}</span>
              </p>
            )}
          </div>
        </div>

        <PendingActionAlerts />

        {isAuditorUser && (
          <div className="space-y-4">
            <h2 className="text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
              Your Progress
            </h2>
            <AuditorDashboard assignmentId={selectedAssignmentId} />
          </div>
        )}

        {isAdminUser && (
          <div className="space-y-4">
            <h2 className="text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
              Organisation Overview
            </h2>
            <AdminStatsRow />
          </div>
        )}

        {isClientUser_ && (
          <div className="space-y-4">
            <h2 className="text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
              Your Audit Status
            </h2>
            <ClientDashboard />
          </div>
        )}

        <InventoryOverview />

        {hasData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 overflow-hidden">
              <DashboardCharts items={currentItems} />
            </div>
            <div className="flex flex-col gap-6">
              <ExceptionTile />
            </div>
          </div>
        ) : !isLoading && (
          <EmptyDashboardState />
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full rounded-xl bg-slate-100 border border-slate-200" />
            <Skeleton className="h-64 w-full rounded-xl bg-slate-100 border border-slate-200" />
          </div>
        )}

        {!isClientUser_ && (
          <div className="grid gap-8 grid-cols-1 lg:grid-cols-2 pt-6">
            <div className="min-h-[300px]">
              <RecentActivity />
            </div>

            <div className="space-y-5">
              <h2 className="text-[12px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-3 pl-1">Quick Actions</h2>

              {isLoading ? <QuickActionSkeleton /> : (
                <div className="grid gap-4 grid-cols-2">
                  {canPerformAudits() && (
                    <Button asChild className="h-28 flex flex-col bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
                      <Link to="/scanner">
                        <Barcode className="h-7 w-7 mb-3 group-hover:scale-110 transition-transform" />
                        Scan Items
                      </Link>
                    </Button>
                  )}

                  {!isClientUser_ && (
                    <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
                      <Link to="/search">
                        <Search className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                        Search
                      </Link>
                    </Button>
                  )}

                  {canUploadData() && (
                    <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
                      <Link to="/upload">
                        <Upload className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                        Upload Data
                      </Link>
                    </Button>
                  )}

                  {canPerformAudits() && (
                    <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
                      <Link to="/questionnaire">
                        <ClipboardList className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                        Questionnaire
                      </Link>
                    </Button>
                  )}

                  {isAdminUser && (
                    <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
                      <Link to="/analytics">
                        <BarChart3 className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                        Analytics
                      </Link>
                    </Button>
                  )}

                  {isSuperAdmin() && (
                    <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
                      <Link to="/users">
                        <Users className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                        Manage Users
                      </Link>
                    </Button>
                  )}

                  <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
                    <Link to="/reports">
                      <FileSpreadsheet className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                      Reports
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {isClientUser_ && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 pt-4">
            <Button asChild className="h-28 flex flex-col bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
              <Link to="/reports">
                <FileSpreadsheet className="h-7 w-7 mb-3 group-hover:scale-110 transition-transform" />
                View Reports
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
              <Link to="/questionnaire">
                <ClipboardList className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                Questionnaires
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-28 flex flex-col bg-white shadow-sm border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-1 active:scale-95 group">
              <Link to="/analytics">
                <BarChart3 className="h-7 w-7 mb-3 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                Analytics
              </Link>
            </Button>
          </div>
        )}

        {!isClientUser_ && (
          <div className="pt-8 pb-4">
            <h2 className="text-[12px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-3 mb-5 pl-1">Inventory Status</h2>
            <div className="overflow-x-auto bg-white shadow-sm border border-slate-200 rounded-xl p-2 w-full max-w-full">
              <InventoryTable />
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default Index;