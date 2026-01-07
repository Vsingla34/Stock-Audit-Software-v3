import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  MapPin,
  LogOut,
  ArrowLeft,
  Hash 
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

  const [assignments, setAssignments] = useState<AssignmentDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Standard check: if no company is selected, go back to company selection
    if (!selectedCompanyId) {
       navigate("/company-selection");
       return;
    }
    fetchAssignments();
  }, [selectedCompanyId, currentUser]);

  const fetchAssignments = async () => {
    if (!currentUser || !selectedCompanyId) return;
    try {
      const { data: assignmentsData, error: assignError } = await supabase
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

      if (assignError) throw assignError;

      const formatted: AssignmentDisplay[] = assignmentsData.map((a: any) => ({
        id: a.id,
        companyName: a.companies?.name || "Unknown Company",
        locationName: a.locations?.name || "Unknown Location",
        locationId: a.location_id,
        companyId: a.company_id,
        status: a.status,
        date: a.scheduled_date ? format(new Date(a.scheduled_date), "MMM dd, yyyy") : "No Date"
      }));

      setAssignments(formatted);

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

  const handleBackToCompanies = () => {
    navigate("/company-selection");
  };

  const handleManageAssignments = () => {
    navigate("/assignments");
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdminOrSuper = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Select Assignment</h2>
            <p className="text-gray-500 text-lg">
              Choose an active audit for the selected company.
            </p>
          </div>
          <div className="flex items-center gap-3">
             {isAdminOrSuper && (
                <Button 
                  variant="outline"
                  onClick={handleManageAssignments}
                  className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm transition-all hidden md:flex"
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Manage Assignments
                </Button>
             )}

             <Button 
               variant="outline" 
               onClick={handleBackToCompanies}
               className="text-gray-600 bg-white"
             >
               <ArrowLeft className="h-4 w-4 mr-2" />
               Change Company
             </Button>

             <Button 
               variant="ghost" 
               onClick={handleLogout}
               className="text-gray-500 hover:text-red-600 hover:bg-red-50"
             >
               <LogOut className="h-4 w-4 mr-2" />
               Log out
             </Button>
          </div>
        </div>

        {/* Mobile Manage Button (Visible only on small screens for Admins) */}
        {isAdminOrSuper && (
           <div className="md:hidden">
              <Button 
                  variant="outline"
                  onClick={handleManageAssignments}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm transition-all"
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Manage Assignments
                </Button>
           </div>
        )}

        {/* Assignments Grid */}
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <Card
              key={assignment.id}
              className="group cursor-pointer border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:border-indigo-200 bg-white"
              onClick={() => handleAssignmentSelect(assignment)}
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                    <ClipboardList className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {assignment.locationName}
                      </h3>
                      {/* ADDED: Assignment ID Badge */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        <Hash className="w-3 h-3 mr-0.5" />
                        {assignment.id}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                         <MapPin className="h-3 w-3" /> {assignment.companyName}
                      </span>
                      <span className="flex items-center gap-1">
                         <CalendarDays className="h-3 w-3" /> {assignment.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                   <div className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide
                     ${assignment.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                   `}>
                     {assignment.status}
                   </div>
                   <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                </div>
              </div>
            </Card>
          ))}

          {!loading && assignments.length === 0 && (
            <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 shadow-none">
              <CardHeader className="text-center py-12">
                <div className="mx-auto bg-white p-4 rounded-full shadow-sm ring-1 ring-gray-900/5 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-gray-900">No Assignments Found</CardTitle>
                <CardDescription className="mt-2 text-gray-500">
                  There are no active assignments for this company.
                </CardDescription>
                
                {/* ALLOW NAVIGATION BACK */}
                <div className="mt-6">
                   <Button onClick={handleBackToCompanies} variant="outline">
                     Select Different Company
                   </Button>
                </div>
              </CardHeader>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
};

export default AssignmentSelection;