// src/pages/AssignmentSelection.tsx — Redesign v2: same technical console
// language as CompanySelection (monospace IDs, status-pulse dots, left
// accent bars) instead of the old blue-badge card-row look.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  LogOut,
  ArrowLeft,
  Building2,
  Building,
  Settings,
  Users,
  Lock,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import { useInventory } from "@/context/InventoryContext";
import { format } from "date-fns";
import logo from "../../public/logo.png";

interface AssignmentDisplay {
  id: number;
  companyName: string;
  locationName: string;
  locationId: string;
  companyId: string;
  status: string;
  date: string;
}

// Status -> visual language. Kept as a single source of truth so the
// accent bar, pulse dot, and badge all agree with each other.
const STATUS_CONFIG: Record<string, { text: string; dot: string; badgeBg: string; badgeText: string; badgeBorder: string; pulse: boolean; label: string }> = {
  active:    { text: "#1D6FE0", dot: "#3B82F6", badgeBg: "#EEF6FF", badgeText: "#1D6FE0", badgeBorder: "#CFE6FF", pulse: true,  label: "Active" },
  submitted: { text: "#B4650F", dot: "#F59E0B", badgeBg: "#FDF3E8", badgeText: "#B4650F", badgeBorder: "#F5DEC0", pulse: true,  label: "Submitted" },
  finalized: { text: "#0F8F5C", dot: "#10B981", badgeBg: "#ECFAF3", badgeText: "#0F8F5C", badgeBorder: "#C9F0DE", pulse: false, label: "Finalized" },
  pending:   { text: "#54547A", dot: "#94A3B8", badgeBg: "#F0F2F7", badgeText: "#54547A", badgeBorder: "#D8D8E6", pulse: false, label: "Pending" },
};

const AssignmentSelection = () => {
  const navigate = useNavigate();
  const { selectedCompanyId, setSelectedCompanyId, setSelectedAssignmentId } = useCompany();
  const { currentUser, logout } = useUser(); 
  const { setSelectedLocationFilter } = useInventory();

  const [activeAssignments, setActiveAssignments] = useState<AssignmentDisplay[]>([]);
  const [historyAssignments, setHistoryAssignments] = useState<AssignmentDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>("");

  const isAdminOrSuper = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const canViewAdminOverview = isAdminOrSuper || currentUser?.role === 'client';

  useEffect(() => {
    if (!selectedCompanyId) {
       navigate("/company-selection");
       return;
    }
    fetchAssignments();
    fetchCompanyName();
  }, [selectedCompanyId, currentUser]);

  const fetchCompanyName = async () => {
    if (!selectedCompanyId) return;
    const { data } = await supabase.from("companies").select("name").eq("id", selectedCompanyId).single();
    if (data) setCompanyName(data.name);
  };

  const fetchAssignments = async () => {
    if (!currentUser || !selectedCompanyId) return;
    try {
      const { data: activeData, error: activeError } = await supabase
        .from("assignments")
        .select(`
          id,
          status,
          scheduled_date,
          company_id,
          location_id,
          auditor_ids, 
          companies (name),
          locations (name)
        `)
        .eq("company_id", selectedCompanyId)
        .neq("status", "finalized") 
        .order("scheduled_date", { ascending: true });

      if (activeError) throw activeError;

      let relevantActiveData = activeData || [];
      if (currentUser.role === 'auditor') {
         relevantActiveData = relevantActiveData.filter((a: any) => {
            const auditorIds = Array.isArray(a.auditor_ids) ? a.auditor_ids : [];
            if (typeof a.auditor_ids === 'string') {
                return a.auditor_ids === currentUser.id;
            }
            return auditorIds.includes(currentUser.id);
         });
      }

      const formattedActive: AssignmentDisplay[] = relevantActiveData.map((a: any) => ({
        id: a.id,
        companyName: a.companies?.name || "Unknown Company",
        locationName: a.locations?.name || "Unknown Location",
        locationId: a.location_id,
        companyId: a.company_id,
        status: a.status,
        date: a.scheduled_date ? format(new Date(a.scheduled_date), "MMM dd, yyyy") : "No Date"
      }));

      setActiveAssignments(formattedActive);

      if (isAdminOrSuper) {
        const { data: historyData, error: historyError } = await supabase
          .from("assignments")
          .select(`
            id,
            status,
            scheduled_date,
            company_id,
            location_id,
            companies (name),
            locations (name)
          `)
          .eq("company_id", selectedCompanyId)
          .eq("status", "finalized") 
          .order("scheduled_date", { ascending: false });

        if (historyError) throw historyError;

        const formattedHistory: AssignmentDisplay[] = (historyData || []).map((a: any) => ({
          id: a.id,
          companyName: a.companies?.name || "Unknown Company",
          locationName: a.locations?.name || "Unknown Location",
          locationId: a.location_id,
          companyId: a.company_id,
          status: a.status,
          date: a.scheduled_date ? format(new Date(a.scheduled_date), "MMM dd, yyyy") : "No Date"
        }));

        setHistoryAssignments(formattedHistory);
      }

    } catch (error: any) {
      console.error("Error loading assignments:", error);
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentSelect = (assignment: AssignmentDisplay) => {
    setSelectedCompanyId(assignment.companyId);
    setSelectedAssignmentId(assignment.id);
    setSelectedLocationFilter(assignment.locationId); 
    
    sessionStorage.setItem("selectedCompanyId", assignment.companyId);
    sessionStorage.setItem("selectedAssignmentId", assignment.id.toString());
    
    setTimeout(() => {
        navigate("/");
    }, 150);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // ── Assignment Row — technical console style, matching CompanySelection ──
  const AssignmentRow = ({ assignment, isHistory = false }: { assignment: AssignmentDisplay, isHistory?: boolean }) => {
    const s = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.pending;
    const paddedId = String(assignment.id).padStart(4, "0");

    return (
      <button
        onClick={() => handleAssignmentSelect(assignment)}
        className="group relative w-full grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-2 sm:gap-4
                   px-5 py-3.5 text-left transition-colors duration-150 hover:bg-violet-50/40"
      >
        {/* Left accent bar — status colored, brightens on hover */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-200 group-hover:w-1"
          style={{ backgroundColor: s.badgeBorder }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ backgroundColor: s.text }}
        />

        {/* Column 1 — icon + location + company */}
        <div className="flex items-center gap-3 min-w-0 pl-2">
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 border
              ${isHistory ? "bg-space-50 border-space-200 text-space-400" : ""}`}
            style={!isHistory ? { backgroundColor: s.badgeBg, borderColor: s.badgeBorder, color: s.text } : undefined}
          >
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className={`text-[14px] font-bold tracking-tight truncate transition-colors duration-150
              ${isHistory ? "text-space-600 group-hover:text-space-900" : "text-space-900 group-hover:text-violet-700"}`}>
              {assignment.locationName}
            </p>
            <p className="text-[11.5px] text-space-400 truncate flex items-center gap-1.5">
              <Building2 className="h-3 w-3 shrink-0 opacity-60" />
              {assignment.companyName}
            </p>
          </div>
        </div>

        {/* Column 2 — monospace assignment ID chip */}
        <div className="flex items-center gap-1.5 pl-11 sm:pl-0">
          <span className="hidden sm:inline text-[11px] text-space-300 font-mono">#</span>
          <span
            className="text-[11px] font-mono font-medium px-2 py-1 rounded"
            style={{ backgroundColor: "#F0F2F7", color: "#54547A" }}
          >
            {paddedId}
          </span>
        </div>

        {/* Column 3 — status pulse + date + arrow */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {s.pulse ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: s.dot }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: s.dot }} />
                </span>
              ) : (
                <span className="inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: s.dot }} />
              )}
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wide" style={{ color: s.text }}>
                {s.label}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-space-400">
              <CalendarDays className="h-3 w-3 opacity-70" />
              {assignment.date}
            </div>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-space-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all duration-150" />
        </div>
      </button>
    );
  };

  // ── Assignment Card — grid style for the Active tab. Deliberately a
  // different visual structure from the row-table (used for History and
  // reused from CompanySelection's pattern), so the two pre-dashboard
  // pages don't look like the same template recolored. ──
  const AssignmentCard = ({ assignment }: { assignment: AssignmentDisplay }) => {
    const s = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.pending;
    const paddedId = String(assignment.id).padStart(4, "0");

    return (
      <button
        onClick={() => handleAssignmentSelect(assignment)}
        className="group relative flex flex-col text-left rounded-2xl border border-space-200 bg-white overflow-hidden
                   transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(110,31,235,0.12)] hover:border-violet-200"
      >
        {/* Top strip — status colored, full width */}
        <div className="h-1 w-full" style={{ backgroundColor: s.dot }} />

        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: s.badgeBg, border: `1px solid ${s.badgeBorder}`, color: s.text }}
            >
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              {s.pulse ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: s.dot }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: s.dot }} />
                </span>
              ) : (
                <span className="inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: s.dot }} />
              )}
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wide" style={{ color: s.text }}>
                {s.label}
              </span>
            </div>
          </div>

          <h3 className="text-[15px] font-bold text-space-900 tracking-tight truncate group-hover:text-violet-700 transition-colors duration-150">
            {assignment.locationName}
          </h3>
          <p className="text-[12px] text-space-500 truncate flex items-center gap-1.5 mt-1">
            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
            {assignment.companyName}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between px-5 py-3 border-t border-space-100 group-hover:bg-violet-50/60 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-medium px-2 py-1 rounded" style={{ backgroundColor: "#F0F2F7", color: "#54547A" }}>
              #{paddedId}
            </span>
            <span className="text-[11px] text-space-400 flex items-center gap-1">
              <CalendarDays className="h-3 w-3 opacity-70" />
              {assignment.date}
            </span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-space-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all duration-200" />
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-space-50 flex flex-col items-center pb-16">
      
      {/* ── Top Navigation Bar ── */}
      <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center bg-white border-b border-space-200 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img src={logo} alt="StockCheck360" className="h-6 w-auto object-contain mix-blend-multiply" />
          <div className="h-4 w-px bg-space-200 hidden sm:block" />
          <span className="text-[12px] font-bold text-space-500 uppercase tracking-widest hidden sm:block">Portal</span>
          {companyName && (
            <>
              <div className="h-4 w-px bg-space-200 hidden sm:block" />
              <span className="text-[13px] font-black text-space-800 tracking-tight hidden sm:block truncate max-w-[200px]">{companyName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button 
             variant="outline" 
             size="sm"
             onClick={() => navigate("/company-selection")}
             className="hidden sm:flex text-space-600 hover:text-violet-700 bg-white border-space-200 hover:bg-space-50 rounded-lg h-9 text-[12px] font-bold tracking-wide transition-all active:scale-[0.98]"
           >
             <ArrowLeft className="h-3.5 w-3.5 mr-2" />
             Change Workspace
           </Button>

          <div className="hidden md:flex items-center gap-2 mx-2">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center shadow-glow-sm"
              style={{ background: "linear-gradient(135deg, #8338FF, #D0219A)" }}
            >
              <span className="text-white font-black text-[13px]">{currentUser?.name?.charAt(0) || "U"}</span>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="text-space-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-9 px-3 text-[11px] font-bold uppercase tracking-widest transition-all"
          >
            <LogOut className="h-3.5 w-3.5 md:mr-2" />
            <span className="hidden md:inline">Log out</span>
          </Button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="w-full max-w-4xl px-4 py-10 md:py-16 space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="section-label">Workspace: {companyName || "…"}</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-space-900">Assignments</h1>
            <p className="text-space-500 text-[14px] font-medium mt-2">Select an active audit assignment to proceed to the dashboard.</p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => navigate("/company-selection")}
            className="md:hidden text-space-600 bg-white border-space-200 h-11 w-full rounded-xl text-[13px] font-bold shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Change Workspace
          </Button>
        </div>

        {/* Quick Actions */}
        {(isAdminOrSuper || canViewAdminOverview) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isAdminOrSuper && (
              <>
                <Button variant="outline" onClick={() => navigate("/locations")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-space-200 hover:border-violet-300 hover:bg-violet-50 rounded-xl text-space-700 hover:text-violet-700 font-bold text-[13px] transition-all duration-200 hover:-translate-y-0.5 active:scale-95 group">
                  <Building className="h-5 w-5 text-space-400 group-hover:text-violet-600 transition-colors" />
                  <span>Locations</span>
                </Button>
                <Button variant="outline" onClick={() => navigate("/assignments")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-space-200 hover:border-violet-300 hover:bg-violet-50 rounded-xl text-space-700 hover:text-violet-700 font-bold text-[13px] transition-all duration-200 hover:-translate-y-0.5 active:scale-95 group">
                  <ClipboardList className="h-5 w-5 text-space-400 group-hover:text-violet-600 transition-colors" />
                  <span>Assignments</span>
                </Button>
                <Button variant="outline" onClick={() => navigate("/users")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-space-200 hover:border-violet-300 hover:bg-violet-50 rounded-xl text-space-700 hover:text-violet-700 font-bold text-[13px] transition-all duration-200 hover:-translate-y-0.5 active:scale-95 group">
                  <Users className="h-5 w-5 text-space-400 group-hover:text-violet-600 transition-colors" />
                  <span>Users</span>
                </Button>
              </>
            )}
            {canViewAdminOverview && (
              <Button variant="outline" onClick={() => navigate("/admin-overview")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-space-200 hover:border-violet-300 hover:bg-violet-50 rounded-xl text-space-700 hover:text-violet-700 font-bold text-[13px] transition-all duration-200 hover:-translate-y-0.5 active:scale-95 group">
                <Settings className="h-5 w-5 text-space-400 group-hover:text-violet-600 transition-colors" />
                <span>Overview</span>
              </Button>
            )}
          </div>
        )}

        {/* ── Assignments — tabbed, not stacked. Active uses a card grid,
             History uses the row-table style. Structurally different
             pages instead of the same list template repeated twice. ── */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="bg-space-100 p-1 h-auto rounded-xl">
            <TabsTrigger
              value="active"
              className="rounded-lg px-4 py-2 text-[12px] font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Active
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {activeAssignments.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg px-4 py-2 text-[12px] font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <History className="h-3.5 w-3.5" />
              History
              {isAdminOrSuper && (
                <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-space-200 text-space-600">
                  {historyAssignments.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Active tab — card grid ── */}
          <TabsContent value="active" className="mt-5">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-space-200 bg-white p-5 animate-pulse">
                    <div className="h-11 w-11 rounded-xl bg-space-100 mb-4" />
                    <div className="h-4 bg-space-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-space-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : activeAssignments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAssignments.map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-space-200 bg-white">
                <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 mb-5">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-space-900 tracking-tight">No Active Assignments</h3>
                <p className="text-[14px] font-medium text-space-500 mt-2 max-w-sm">
                  {currentUser?.role === 'auditor' 
                    ? "You haven't been assigned to any active audits yet." 
                    : `There are no pending audits for ${companyName}.`}
                </p>
                <Button variant="outline" onClick={() => navigate("/company-selection")} className="mt-6 rounded-lg text-[13px] font-bold border-space-200 shadow-sm hover:bg-space-50">
                  Select Different Workspace
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── History tab — always present, but transparent about access
               instead of silently disappearing for non-admin roles ── */}
          <TabsContent value="history" className="mt-5">
            {!isAdminOrSuper ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-space-200 bg-white/50">
                <div className="bg-space-100 p-4 rounded-2xl mb-5">
                  <Lock className="h-8 w-8 text-space-400" />
                </div>
                <h3 className="text-lg font-black text-space-700 tracking-tight">History is admin-only</h3>
                <p className="text-[13px] font-medium text-space-400 mt-2 max-w-sm">
                  Finalized audit history is visible to admins and super admins.
                  Contact your admin if you need access to past audits.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-space-200 bg-white overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
                <div className="divide-y divide-space-100">
                  {historyAssignments.map((assignment) => (
                    <AssignmentRow key={assignment.id} assignment={assignment} isHistory={true} />
                  ))}
                  {historyAssignments.length === 0 && !loading && (
                     <div className="py-12 text-center">
                        <History className="h-8 w-8 text-space-300 mx-auto mb-3" />
                        <p className="text-[13px] font-bold uppercase tracking-widest text-space-400">
                          No finalized audits yet
                        </p>
                        <p className="text-[12px] text-space-400 mt-1">
                          Completed assignments will appear here once finalized.
                        </p>
                     </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AssignmentSelection;