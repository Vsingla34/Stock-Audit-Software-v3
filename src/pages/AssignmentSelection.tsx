import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  MapPin,
  LogOut,
  ArrowLeft,
  Hash,
  History,
  Building,
  Settings,
  Users,
  LayoutDashboard,
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import { useInventory } from "@/context/InventoryContext";
import { format } from "date-fns";

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
      // 1. Fetch Active Assignments
      const { data: activeData, error: activeError } = await supabase
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
        .neq("status", "finalized") 
        .order("scheduled_date", { ascending: true });

      if (activeError) throw activeError;

      const formattedActive: AssignmentDisplay[] = (activeData || []).map((a: any) => ({
        id: a.id,
        companyName: a.companies?.name || "Unknown Company",
        locationName: a.locations?.name || "Unknown Location",
        locationId: a.location_id,
        companyId: a.company_id,
        status: a.status,
        date: a.scheduled_date ? format(new Date(a.scheduled_date), "MMM dd, yyyy") : "No Date"
      }));

      setActiveAssignments(formattedActive);

      // 2. Fetch History Assignments (Admin Only)
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
    
    localStorage.setItem("selectedCompanyId", assignment.companyId);
    sessionStorage.setItem("selectedAssignmentId", assignment.id.toString());
    
    navigate("/");
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 shadow-none">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200 shadow-none">Pending</Badge>;
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none">Submitted</Badge>;
      case "finalized":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 shadow-none">Finalized</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const AssignmentCard = ({ assignment, isHistory = false }: { assignment: AssignmentDisplay, isHistory?: boolean }) => (
    <Card
      onClick={() => handleAssignmentSelect(assignment)}
      className={`group relative overflow-hidden cursor-pointer transition-all duration-300 border-gray-200 
        ${isHistory 
          ? 'bg-gray-50/50 hover:bg-white hover:shadow-md hover:border-gray-300' 
          : 'bg-white hover:shadow-lg hover:border-indigo-300 hover:-translate-y-1'
        }`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${isHistory ? 'bg-gray-300' : 'bg-indigo-500 group-hover:bg-indigo-600'}`} />
      
      <CardContent className="p-5 pl-7">
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-indigo-700 transition-colors flex items-center gap-2">
              {assignment.locationName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
               <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                  <Hash className="w-3 h-3" /> {assignment.id}
               </span>
               <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {assignment.companyName}
               </span>
            </div>
          </div>
          {getStatusBadge(assignment.status)}
        </div>

        <div className="flex items-center justify-between mt-4">
           <div className="flex items-center text-sm text-gray-500 gap-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span>{assignment.date}</span>
           </div>
           
           <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all 
             ${isHistory ? 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600' : 'bg-indigo-50 text-indigo-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
              <ArrowRight className="h-4 w-4" />
           </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      
      {/* 1. Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-none">
                StockCheck<span className="text-indigo-600">360</span>
              </h1>
              {companyName && (
                <p className="text-xs text-gray-500 font-medium">{companyName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
               variant="ghost" 
               size="sm"
               onClick={() => navigate("/company-selection")}
               className="text-gray-600 hover:text-gray-900 hidden sm:flex"
             >
               <ArrowLeft className="h-4 w-4 mr-2" />
               Change Company
             </Button>
            <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block"></div>
            <Button 
               variant="ghost" 
               size="sm"
               onClick={handleLogout}
               className="text-gray-500 hover:text-red-600 hover:bg-red-50"
             >
               <LogOut className="h-4 w-4 mr-2" />
               Log out
             </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 2. Page Header & Admin Toolbar */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Select Assignment</h2>
              <p className="text-gray-500 mt-1">Select an active audit assignment to proceed.</p>
            </div>
          </div>

          {/* Admin Tools Grid */}
          {(isAdminOrSuper || canViewAdminOverview) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {isAdminOrSuper && (
                <>
                  <Button variant="outline" onClick={() => navigate("/locations")} className="h-auto py-3 flex-col gap-2 bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm">
                    <Building className="h-5 w-5" />
                    <span className="font-medium">Locations</span>
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/assignments")} className="h-auto py-3 flex-col gap-2 bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm">
                    <ClipboardList className="h-5 w-5" />
                    <span className="font-medium">Assignments</span>
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/users")} className="h-auto py-3 flex-col gap-2 bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm">
                    <Users className="h-5 w-5" />
                    <span className="font-medium">Users</span>
                  </Button>
                </>
              )}
              {canViewAdminOverview && (
                <Button variant="outline" onClick={() => navigate("/admin-overview")} className="h-auto py-3 flex-col gap-2 bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm">
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Overview</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 3. Active Assignments Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <h3 className="text-lg font-semibold text-gray-900">Active Assignments</h3>
            <Badge variant="secondary" className="ml-auto bg-gray-100 text-gray-600">
              {activeAssignments.length} Found
            </Badge>
          </div>

          {loading ? (
             <div className="grid md:grid-cols-2 gap-4">
               {[1,2].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}
             </div>
          ) : activeAssignments.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {activeAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-2 bg-gray-50/50 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-white p-3 rounded-full shadow-sm ring-1 ring-gray-900/5 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="font-medium text-gray-900">No Active Assignments</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                  All caught up! There are no pending audits for {companyName}.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/company-selection")} className="mt-4">
                  Select Different Company
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* 4. History Assignments Section (Admin Only) */}
        {isAdminOrSuper && (
          <section className="space-y-4 pt-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <div className="h-2.5 w-2.5 rounded-full bg-gray-400"></div>
              <h3 className="text-lg font-semibold text-gray-900">Audit History</h3>
              <Badge variant="secondary" className="ml-auto bg-gray-100 text-gray-600">
                {historyAssignments.length} Archived
              </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4 opacity-90 hover:opacity-100 transition-opacity">
              {historyAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} isHistory={true} />
              ))}
              {historyAssignments.length === 0 && !loading && (
                 <p className="text-sm text-gray-400 italic col-span-2 py-4 text-center">No history records found.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AssignmentSelection;