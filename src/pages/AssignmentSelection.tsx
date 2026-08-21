// src/pages/AssignmentSelection.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  LogOut,
  ArrowLeft,
  Hash,
  Building2,
  Building,
  Settings,
  Users,
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

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      active:    "bg-blue-50 text-blue-700 border-blue-200",
      submitted: "bg-amber-50 text-amber-700 border-amber-200",
      finalized: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending:   "bg-slate-50 text-slate-600 border-slate-200",
    };
    const label: Record<string, string> = {
      active: "Active", submitted: "Submitted", finalized: "Finalized", pending: "Pending"
    };
    
    const classes = config[status] || config.pending;
    const text = label[status] || status;

    return (
      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded border ${classes}`}>
        {text}
      </span>
    );
  };

  // ── Assignment Row Component (Replaces Blocky Cards) ──
  const AssignmentRow = ({ assignment, isHistory = false }: { assignment: AssignmentDisplay, isHistory?: boolean }) => (
    <div
      onClick={() => handleAssignmentSelect(assignment)}
      className={`group flex items-center justify-between p-5 transition-colors duration-200 cursor-pointer
        ${isHistory ? 'hover:bg-slate-50' : 'hover:bg-blue-50/50'}`}
    >
      <div className="flex items-center gap-5 min-w-0">
        
        {/* Dynamic Icon Avatar */}
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 border
          ${isHistory 
            ? 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-500' 
            : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-blue-100 group-hover:border-blue-200 group-hover:text-blue-600'
          }`}>
          <ClipboardList className="h-5 w-5" />
        </div>

        {/* Text Details */}
        <div className="min-w-0">
          <h3 className={`text-[16px] font-bold tracking-tight transition-colors duration-200 truncate
            ${isHistory ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-900 group-hover:text-blue-700'}`}>
            {assignment.locationName}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-slate-500">
             <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest">
                <Hash className="w-3.5 h-3.5 opacity-70" /> {assignment.id}
             </span>
             <div className="h-3 w-px bg-slate-200" />
             <span className="flex items-center gap-1.5 text-[13px] font-medium truncate">
                <Building2 className="w-3.5 h-3.5 opacity-70 shrink-0" /> {assignment.companyName}
             </span>
          </div>
        </div>
      </div>

      {/* Right Side Info & Action */}
      <div className="flex items-center gap-6 shrink-0 pl-4">
         <div className="hidden sm:flex flex-col items-end gap-1.5">
            {getStatusBadge(assignment.status)}
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 opacity-70" />
              {assignment.date}
            </div>
         </div>
         <div className="sm:hidden">
            {getStatusBadge(assignment.status)}
         </div>
         
         {/* Arrow Button */}
         <div className={`flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-300 shadow-sm
           ${isHistory 
              ? 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-white group-hover:text-slate-600 group-hover:shadow-md' 
              : 'bg-white border-slate-200 text-slate-300 group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white group-hover:shadow-md'
           }`}>
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
         </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-16">
      
      {/* ── 1. Top Navigation Bar ── */}
      <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img src={logo} alt="StockCheck360" className="h-6 w-auto object-contain mix-blend-multiply" />
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <span className="text-[12px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Portal</span>
          {companyName && (
            <>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <span className="text-[13px] font-black text-slate-800 tracking-tight hidden sm:block truncate max-w-[200px]">{companyName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button 
             variant="outline" 
             size="sm"
             onClick={() => navigate("/company-selection")}
             className="hidden sm:flex text-slate-600 hover:text-blue-700 bg-white border-slate-200 hover:bg-slate-50 rounded-lg h-9 text-[12px] font-bold tracking-wide transition-all active:scale-[0.98]"
           >
             <ArrowLeft className="h-3.5 w-3.5 mr-2" />
             Change Workspace
           </Button>

          <div className="hidden md:flex items-center gap-2 mx-2">
            <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-black text-[13px]">{currentUser?.name?.charAt(0) || "U"}</span>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-9 px-3 text-[11px] font-bold uppercase tracking-widest transition-all"
          >
            <LogOut className="h-3.5 w-3.5 md:mr-2" />
            <span className="hidden md:inline">Log out</span>
          </Button>
        </div>
      </div>

      {/* ── 2. Centered Main Content Area ── */}
      <main className="w-full max-w-4xl px-4 py-10 md:py-16 space-y-10">
        
        {/* Header & Mobile Action */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Assignments</h1>
            <p className="text-slate-500 text-[14px] font-medium mt-2">Select an active audit assignment to proceed to the dashboard.</p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => navigate("/company-selection")}
            className="md:hidden text-slate-600 bg-white border-slate-200 h-11 w-full rounded-xl text-[13px] font-bold shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Change Workspace
          </Button>
        </div>

        {/* Compact Admin Quick Actions */}
        {(isAdminOrSuper || canViewAdminOverview) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isAdminOrSuper && (
              <>
                <Button variant="outline" onClick={() => navigate("/locations")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-0.5 active:scale-95 group">
                  <Building className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  <span>Locations</span>
                </Button>
                <Button variant="outline" onClick={() => navigate("/assignments")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-0.5 active:scale-95 group">
                  <ClipboardList className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  <span>Assignments</span>
                </Button>
                <Button variant="outline" onClick={() => navigate("/users")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-0.5 active:scale-95 group">
                  <Users className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  <span>Users</span>
                </Button>
              </>
            )}
            {canViewAdminOverview && (
              <Button variant="outline" onClick={() => navigate("/admin-overview")} className="h-14 flex justify-start px-4 gap-3 bg-white shadow-sm border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-[13px] transition-all duration-300 hover:-translate-y-0.5 active:scale-95 group">
                <Settings className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                <span>Overview</span>
              </Button>
            )}
          </div>
        )}

        {/* ── Active Assignments List ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
            <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-500">Active Assignments</h3>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ml-auto">
              {activeAssignments.length} Found
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
               <div className="divide-y divide-slate-100">
                 {[1,2,3].map(i => (
                   <div key={i} className="flex items-center justify-between p-5 animate-pulse">
                     <div className="flex items-center gap-5">
                       <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0" />
                       <div className="space-y-2">
                         <div className="h-4 w-32 bg-slate-100 rounded" />
                         <div className="h-3 w-48 bg-slate-100 rounded" />
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            ) : activeAssignments.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {activeAssignments.map((assignment) => (
                  <AssignmentRow key={assignment.id} assignment={assignment} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-5">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">No Active Assignments</h3>
                <p className="text-[14px] font-medium text-slate-500 mt-2 max-w-sm">
                  {currentUser?.role === 'auditor' 
                    ? "You haven't been assigned to any active audits yet." 
                    : `There are no pending audits for ${companyName}.`}
                </p>
                <Button variant="outline" onClick={() => navigate("/company-selection")} className="mt-6 rounded-lg text-[13px] font-bold border-slate-200 shadow-sm hover:bg-slate-50">
                  Select Different Workspace
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ── History Assignments List ── */}
        {isAdminOrSuper && (
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
              <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-400">Audit History</h3>
              <span className="bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ml-auto">
                {historyAssignments.length} Archived
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
              <div className="divide-y divide-slate-100">
                {historyAssignments.map((assignment) => (
                  <AssignmentRow key={assignment.id} assignment={assignment} isHistory={true} />
                ))}
                {historyAssignments.length === 0 && !loading && (
                   <div className="py-8 text-center text-[13px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/50">
                      No history records found
                   </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AssignmentSelection;