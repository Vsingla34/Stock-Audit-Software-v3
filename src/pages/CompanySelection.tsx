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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  Briefcase,
  LogOut,
  Settings 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext"; 
import { CompanyForm } from "@/components/company/CompanyForm"; 

interface Company {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
}

const CompanySelection = () => {
  const navigate = useNavigate();
  const { setSelectedCompanyId } = useCompany();
  const { logout } = useUser(); 

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, assigned_companies")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      setUserRole(profile.role);

      let companiesQuery = supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (profile.role !== "super_admin") {
        if (!profile.assigned_companies || profile.assigned_companies.length === 0) {
           setCompanies([]);
           setLoading(false);
           return;
        }
        companiesQuery = companiesQuery.in("id", profile.assigned_companies);
      }

      const { data: companiesData, error: companiesError } =
        await companiesQuery;
      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

    } catch (error: any) {
      console.error("Error loading company selection data:", error);
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
    try {
      localStorage.setItem("selectedCompanyId", companyId);
      sessionStorage.setItem("selectedCompanyId", companyId);
    } catch {
      // Ignore storage errors
    }
    navigate("/assignment-selection");
  };

  const handleCompanyCreated = () => {
    setIsAddDialogOpen(false); 
    fetchInitialData(); 
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isSuperAdmin = userRole === "super_admin";

  if (!loading && companies.length === 0 && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="absolute top-4 right-4">
          <Button variant="ghost" onClick={handleLogout} className="text-gray-500">
            <LogOut className="h-4 w-4 mr-2" /> Log out
          </Button>
        </div>

        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <span className="text-3xl font-bold text-gray-900 tracking-tight">StockCheck360</span>
        </div>
        <Card className="max-w-md w-full border-gray-200 shadow-xl">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gray-100 rounded-full">
                <Briefcase className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            <CardTitle className="text-center text-xl text-gray-900">
              No Companies Available
            </CardTitle>
            <CardDescription className="text-center mt-2 text-gray-500">
              You have not been assigned to any companies. Please contact the Super Administrator to get access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Select Company</h2>
            <p className="text-gray-500 text-lg">
              Choose a workspace to proceed to assignment selection.
            </p>
          </div>

          <div className="flex items-center gap-3">
             {isSuperAdmin && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => navigate("/add-company")}
                    className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm transition-all"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Companies
                  </Button>
                  
                  <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Company
                  </Button>
                </>
              )}

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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="group cursor-pointer border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 bg-white"
              onClick={() => handleCompanySelect(company.id)}
            >
              <CardHeader className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors border border-indigo-100">
                      <Building2 className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {company.name}
                      </CardTitle>
                      <CardDescription className="mt-1 text-gray-500 line-clamp-1">
                        {company.address || "No address provided"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="p-1 rounded-full text-gray-300 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Add New Company</DialogTitle>
              <DialogDescription className="text-gray-500">
                Enter the details below to create a new company workspace.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <CompanyForm 
                onSuccess={handleCompanyCreated}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default CompanySelection;