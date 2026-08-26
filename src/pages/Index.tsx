// src/pages/Index.tsx
// Phase 4: Role-specific landing (4.2), Charts (4.1), Exception tile (4.3),
//          Pending alerts (4.4), Loading skeletons (4.6), Empty states (4.6)

import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { InventoryOverview } from "@/components/dashboard/InventoryOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { PendingActionAlerts, ExceptionTile } from "@/components/dashboard/PendingActionAlerts";
import { FloorView } from "@/components/floor/FloorView";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  Barcode,
  Search,
  ClipboardList,
  Upload,
  FileSpreadsheet,
  BarChart3,
  Users,
  MapPin,
  ScanBarcode,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import { useInventory } from "@/context/InventoryContext";
import { supabase } from "@/integrations/supabase/client";

// ── Skeleton for quick-action cards ──────────────────────────────────────────
const QuickActionSkeleton = () => (
  <div className="grid gap-4 grid-cols-2">
    {[1, 2, 3, 4].map((i) => (
      <Skeleton key={i} className="h-24 w-full rounded-xl" />
    ))}
  </div>
);

// ── Role badge ────────────────────────────────────────────────────────────────
const RoleBadge = ({ role }: { role: string }) => {
  const config: Record<string, string> = {
    super_admin: "bg-purple-100 text-purple-800 border-purple-200",
    admin:       "bg-indigo-100 text-indigo-800 border-indigo-200",
    auditor:     "bg-blue-100  text-blue-800  border-blue-200",
    client:      "bg-green-100 text-green-800 border-green-200",
  };
  const label: Record<string, string> = {
    super_admin: "Super Admin",
    admin:       "Admin",
    auditor:     "Auditor",
    client:      "Client",
  };
  return (
    <span
      className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
        config[role] || "bg-gray-100 text-gray-800 border-gray-200"
      }`}
    >
      {label[role] || role}
    </span>
  );
};

// ── 4.2: Auditor-specific section ────────────────────────────────────────────
const AuditorDashboard = ({ assignmentId }: { assignmentId: string | null }) => {
  const { itemMaster, auditedItems, assignments } = useInventory();

  const stats = useMemo(() => {
    if (!assignmentId) return null;
    const total    = itemMaster.filter(i => String(i.assignmentId) === String(assignmentId)).length;
    const scanned  = auditedItems.filter(i => String(i.assignmentId) === String(assignmentId) && i.status !== "pending").length;
    const pending  = total - scanned;
    const pct      = total > 0 ? Math.round((scanned / total) * 100) : 0;
    return { total, scanned, pending, pct };
  }, [itemMaster, auditedItems, assignmentId]);

  if (!assignmentId || !stats) return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">No active assignment</p>
          <p className="text-xs text-amber-600">Contact your admin to be assigned to a location.</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-blue-800">{stats.total}</div>
        <div className="text-xs text-blue-600 mt-0.5">Total SKUs</div>
      </div>
      <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-green-800">{stats.scanned}</div>
        <div className="text-xs text-green-600 mt-0.5">Scanned</div>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-amber-800">{stats.pending}</div>
        <div className="text-xs text-amber-600 mt-0.5">Remaining</div>
      </div>

      {/* Progress bar */}
      <div className="col-span-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Your progress today</span>
          <span className="font-semibold text-indigo-600">{stats.pct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// ── 4.2: Admin-specific stats row ────────────────────────────────────────────
const AdminStatsRow = () => {
  const { assignments, locations } = useInventory();
  const { selectedCompanyId } = useCompany();

  const stats = useMemo(() => {
    const companyAssignments = assignments.filter(
      (a) => String(a.companyId) === String(selectedCompanyId)
    );
    return {
      total:     companyAssignments.length,
      active:    companyAssignments.filter((a) => a.status === "active").length,
      submitted: companyAssignments.filter((a) => a.status === "submitted").length,
      finalized: companyAssignments.filter((a) => a.status === "finalized").length,
      locations: locations.filter((l) => String(l.companyId) === String(selectedCompanyId)).length,
    };
  }, [assignments, locations, selectedCompanyId]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Active Audits",   value: stats.active,    icon: <ScanBarcode className="h-4 w-4" />, color: "indigo" },
        { label: "Awaiting Review", value: stats.submitted,  icon: <Clock className="h-4 w-4" />,       color: "amber"  },
        { label: "Finalized",       value: stats.finalized,  icon: <CheckCircle2 className="h-4 w-4" />, color: "green" },
        { label: "Locations",       value: stats.locations,  icon: <MapPin className="h-4 w-4" />,       color: "blue"  },
      ].map((s) => (
        <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-3`}>
          <div className={`text-${s.color}-500 mb-1`}>{s.icon}</div>
          <div className={`text-2xl font-bold text-${s.color}-800`}>{s.value}</div>
          <div className={`text-xs text-${s.color}-600 mt-0.5`}>{s.label}</div>
        </div>
      ))}
    </div>
  );
};

// ── 4.2: Client-specific section ─────────────────────────────────────────────
const ClientDashboard = () => {
  const { assignments } = useInventory();
  const { selectedCompanyId } = useCompany();

  const relevant = useMemo(() =>
    assignments
      .filter((a) => String(a.companyId) === String(selectedCompanyId))
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .slice(0, 3),
    [assignments, selectedCompanyId]
  );

  if (relevant.length === 0) return (
    <div className="text-center py-8 text-gray-400 text-sm">No audit assignments yet.</div>
  );

  const statusLabel: Record<string, { label: string; cls: string }> = {
    active:    { label: "In Progress", cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    submitted: { label: "Awaiting Your Sign-off", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    finalized: { label: "Finalized", cls: "bg-green-100 text-green-700 border-green-200" },
    pending:   { label: "Not Started", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  };

  return (
    <div className="space-y-2">
      {relevant.map((a) => {
        const s = statusLabel[a.status] || statusLabel.pending;
        return (
          <div key={a.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
            <div>
              <p className="text-sm font-medium text-gray-800">Assignment #{a.id}</p>
              <p className="text-xs text-gray-500">
                {new Date(a.scheduledDate).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.cls}`}>
              {s.label}
            </span>
          </div>
        );
      })}
      <Link to="/reports" className="block text-center text-xs text-indigo-600 hover:underline pt-1">
        View all reports →
      </Link>
    </div>
  );
};

// ── 4.6: Empty state ──────────────────────────────────────────────────────────
const EmptyDashboardState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
    <div className="p-5 bg-indigo-50 rounded-full">
      <BarChart3 className="h-10 w-10 text-indigo-400" />
    </div>
    <div>
      <p className="font-semibold text-gray-700 text-lg">No data yet</p>
      <p className="text-sm text-gray-500 mt-1 max-w-xs">
        Upload your closing stock and start an assignment to see the dashboard come to life.
      </p>
    </div>
    <div className="flex gap-3 flex-wrap justify-center">
      <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
        <Link to="/upload"><Upload className="h-4 w-4 mr-1.5" />Upload Stock</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link to="/assignments"><ClipboardList className="h-4 w-4 mr-1.5" />Manage Assignments</Link>
      </Button>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const Index = () => {
  const { canUploadData, canPerformAudits, isClientUser, isSuperAdmin, isAdmin, isAuditor } = useUserAccess();
  const { currentUser }                  = useUser();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const { itemMaster, auditedItems, isLoading, assignments }     = useInventory();

  const [companyName, setCompanyName] = useState("");

  const role = currentUser?.role || "auditor";
  const isAdminUser   = isSuperAdmin() || isAdmin();
  const isAuditorUser = isAuditor();
  const isClientUser_ = isClientUser();

  useEffect(() => {
    if (!selectedCompanyId) return;
    supabase
      .from("companies")
      .select("name")
      .eq("id", selectedCompanyId)
      .single()
      .then(({ data }) => { if (data?.name) setCompanyName(data.name); })
      .catch(() => {});
  }, [selectedCompanyId]);

  // Items for current assignment (used by charts)
  const currentItems = useMemo(() => {
    if (!selectedAssignmentId) return [];
    return itemMaster
      .map((m) => {
        const a = auditedItems.find((ai) => ai.id === m.id);
        return a || m;
      })
      .filter((i) => String(i.assignmentId) === String(selectedAssignmentId));
  }, [itemMaster, auditedItems, selectedAssignmentId]);

  const hasData = currentItems.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                Welcome, <span className="text-indigo-600">{currentUser?.name || "User"}</span>
              </h1>
              <RoleBadge role={role} />
            </div>
            <p className="text-base text-muted-foreground">Dashboard</p>
          </div>
          <div className="text-left md:text-right">
            {companyName && (
              <h2 className="text-xl font-bold text-gray-900">{companyName}</h2>
            )}
            {selectedAssignmentId && (
              <p className="text-sm text-gray-500 mt-0.5">
                Assignment <span className="text-indigo-600 font-semibold">#{selectedAssignmentId}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── 4.4: Pending action alerts (all roles) ── */}
        <PendingActionAlerts />

        {/* ── 4.2: Role-specific section ── */}
        {isAuditorUser && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Your Progress
            </h2>
            <AuditorDashboard assignmentId={selectedAssignmentId} />
          </div>
        )}

        {isAdminUser && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Organisation Overview
            </h2>
            <AdminStatsRow />
          </div>
        )}

        {isClientUser_ && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Your Audit Status
            </h2>
            <ClientDashboard />
          </div>
        )}

        {/* ── Inventory Overview card ── */}
        <InventoryOverview />

        {/* ── 4.1: Charts + 4.3: Exception tile ── */}
        {hasData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DashboardCharts items={currentItems} />
            </div>
            <div className="flex flex-col gap-4">
              <ExceptionTile />
            </div>
          </div>
        ) : !isLoading && (
          <EmptyDashboardState />
        )}

        {/* ── Build 03: Live Floor — admins only, only while the current
             assignment is actively being counted. Not shown to clients or
             auditors (an auditor doesn't need to watch themselves), and
             not shown once an assignment is submitted/finalized since
             there's no more live scanning happening. ── */}
        {isAdminUser && selectedAssignmentId && (() => {
          const currentAssignment = assignments.find(
            (a) => String(a.id) === String(selectedAssignmentId)
          );
          if (currentAssignment?.status !== "active") return null;
          return (
            <div>
              <p className="section-label">Live floor</p>
              <FloorView assignmentId={selectedAssignmentId} />
            </div>
          );
        })()}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {/* ── Main grid: Recent Activity + Quick Actions ── */}
        {!isClientUser_ && (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <div className="min-h-[300px]">
              <RecentActivity />
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>

              {isLoading ? <QuickActionSkeleton /> : (
                <div className="grid gap-3 grid-cols-2">

                  {/* Scan — auditors + admins */}
                  {canPerformAudits() && (
                    <Button asChild className="h-24 flex flex-col bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                      <Link to="/scanner">
                        <Barcode className="h-6 w-6 mb-1.5" />
                        Scan Items
                      </Link>
                    </Button>
                  )}

                  {/* Search */}
                  {!isClientUser_ && (
                    <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
                      <Link to="/search">
                        <Search className="h-6 w-6 mb-1.5 text-indigo-500" />
                        Search
                      </Link>
                    </Button>
                  )}

                  {/* Upload — admins only */}
                  {canUploadData() && (
                    <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
                      <Link to="/upload">
                        <Upload className="h-6 w-6 mb-1.5 text-indigo-500" />
                        Upload Data
                      </Link>
                    </Button>
                  )}

                  {/* Questionnaires */}
                  {canPerformAudits() && (
                    <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
                      <Link to="/questionnaire">
                        <ClipboardList className="h-6 w-6 mb-1.5 text-indigo-500" />
                        Questionnaire
                      </Link>
                    </Button>
                  )}

                  {/* Analytics — admins only */}
                  {isAdminUser && (
                    <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
                      <Link to="/analytics">
                        <BarChart3 className="h-6 w-6 mb-1.5 text-indigo-500" />
                        Analytics
                      </Link>
                    </Button>
                  )}

                  {/* Users — super admin */}
                  {isSuperAdmin() && (
                    <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
                      <Link to="/users">
                        <Users className="h-6 w-6 mb-1.5 text-indigo-500" />
                        Manage Users
                      </Link>
                    </Button>
                  )}

                  {/* Reports — always visible */}
                  <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
                    <Link to="/reports">
                      <FileSpreadsheet className="h-6 w-6 mb-1.5 text-indigo-500" />
                      Reports
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Client quick actions ── */}
        {isClientUser_ && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <Button asChild className="h-24 flex flex-col bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
              <Link to="/reports">
                <FileSpreadsheet className="h-6 w-6 mb-1.5" />
                View Reports
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
              <Link to="/questionnaire">
                <ClipboardList className="h-6 w-6 mb-1.5 text-indigo-500" />
                Questionnaires
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-24 flex flex-col hover:bg-indigo-50 hover:text-indigo-700 shadow-sm">
              <Link to="/analytics">
                <BarChart3 className="h-6 w-6 mb-1.5 text-indigo-500" />
                Analytics
              </Link>
            </Button>
          </div>
        )}

        {/* ── Inventory table — admins and auditors ── */}
        {!isClientUser_ && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Inventory Status</h2>
            <div className="overflow-x-auto">
              <InventoryTable />
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default Index;