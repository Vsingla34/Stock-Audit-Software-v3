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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";
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

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
    navigate("/");
  };

  const handleCompanyCreated = () => {
    setIsAddDialogOpen(false); 
    fetchInitialData(); 
  };

  const isSuperAdmin = userRole === "super_admin";

  if (!loading && companies.length === 0 && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <span className="text-3xl font-bold text-slate-900 tracking-tight">StockCheck360</span>
        </div>
        <Card className="max-w-md w-full border-0 shadow-xl ring-1 ring-slate-900/5">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              No Companies Available
            </CardTitle>
            <CardDescription className="text-center mt-2">
              You have not been assigned to any companies. Please contact the Super Administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        

          <div className="flex items-center gap-4">
             {isSuperAdmin && (
                <Button 
                  onClick={() => setIsAddDialogOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Company
                </Button>
              )}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Select Company</h2>
          <p className="text-slate-500 text-lg">
            Choose a workspace to access your dashboard and inventory data.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="group cursor-pointer border-0 shadow-md ring-1 ring-slate-900/5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:ring-indigo-500/20 bg-white"
              onClick={() => handleCompanySelect(company.id)}
            >
              <CardHeader className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                      <Building2 className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {company.name}
                      </CardTitle>
                      <CardDescription className="mt-1 text-slate-500 line-clamp-1">
                        {company.address || "No address provided"}
                      </CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
            </Card>
          ))}

          {!loading && companies.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3 border-dashed border-2 border-slate-200 bg-slate-50/50 shadow-none">
              <CardHeader className="text-center py-12">
                <div className="mx-auto bg-white p-4 rounded-full shadow-sm ring-1 ring-slate-900/5 mb-4">
                  <Building2 className="h-8 w-8 text-slate-400" />
                </div>
                <CardTitle className="text-slate-900">No companies found</CardTitle>
                <CardDescription className="mt-2 max-w-sm mx-auto">
                  {isSuperAdmin
                    ? "Get started by creating your first company workspace using the button above."
                    : "You don't have access to any companies yet. Please contact your administrator."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
              <DialogDescription>
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