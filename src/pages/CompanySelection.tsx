// src/pages/CompanySelection.tsx
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
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  Briefcase,
  LogOut,
  Settings,
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext"; 
import { CompanyForm } from "@/components/company/CompanyForm"; 
import logo from "../../public/logo.png";

interface Company {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
}

const CompanySelection = () => {
  const navigate = useNavigate();
  const { setSelectedCompanyId } = useCompany();
  const { logout, currentUser } = useUser(); 

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

  // ── Helper to get first letter for Company Avatar ──
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // ── Empty State for Non-Admins ──────────────────────────────────────────────
  if (!loading && companies.length === 0 && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center">
        {/* Top Navigation Bar */}
        <div className="w-full px-6 py-4 flex justify-between items-center bg-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img src={logo} alt="StockCheck360" className="h-6 w-auto object-contain mix-blend-multiply" />
            <span className="text-[14px] font-bold text-slate-900 tracking-tight">StockCheck360</span>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-[12px] font-bold uppercase tracking-widest transition-all h-8 px-3">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Log out
          </Button>
        </div>

        {/* Centered Empty Content */}
        <div className="flex-1 flex items-center justify-center p-4 w-full">
          <Card className="max-w-md w-full border border-slate-200 shadow-xl bg-white rounded-2xl p-4">
            <CardHeader>
              <div className="flex justify-center mb-5">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <Briefcase className="h-8 w-8 text-slate-400" />
                </div>
              </div>
              <CardTitle className="text-center text-2xl font-black text-slate-900 tracking-tight">
                No Workspaces
              </CardTitle>
              <CardDescription className="text-center mt-3 text-[14px] font-medium text-slate-500 leading-relaxed">
                You have not been assigned to any companies. Please contact your system administrator to request access.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // ── Main List Layout UI ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      
      {/* ── 1. Top Navigation Bar ── */}
      <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="StockCheck360" className="h-6 w-auto object-contain mix-blend-multiply" />
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <span className="text-[12px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Portal</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 mr-2">
            <div className="h-8 w-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-[12px]">{currentUser?.name?.charAt(0) || "U"}</span>
            </div>
            <span className="text-[13px] font-bold text-slate-700">{currentUser?.name}</span>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg h-8 px-3 text-[11px] font-bold uppercase tracking-widest transition-all"
          >
            <LogOut className="h-3.5 w-3.5 md:mr-2" />
            <span className="hidden md:inline">Log out</span>
          </Button>
        </div>
      </div>

      {/* ── 2. Centered Main Content Area ── */}
      <div className="w-full max-w-4xl px-4 py-10 md:py-16">
        
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Workspaces</h1>
            <p className="text-slate-500 text-[14px] font-medium mt-2">
              Select a company to access its audit assignments.
            </p>
          </div>

          {isSuperAdmin && (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                onClick={() => navigate("/add-company")}
                className="bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-700 border-slate-200 shadow-sm rounded-lg h-10 text-[13px] font-bold transition-all active:scale-[0.98]"
              >
                <Settings className="mr-2 h-4 w-4 text-slate-400" />
                Manage
              </Button>
              
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded-lg h-10 text-[13px] font-bold tracking-wide transition-all active:scale-[0.98]"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New
              </Button>
            </div>
          )}
        </div>

        {/* ── 3. List Container ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          
          {loading && (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-5 animate-pulse">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-100 rounded w-1/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && companies.length > 0 && (
            <div className="divide-y divide-slate-100">
              {companies.map((company) => (
                <div
                  key={company.id}
                  onClick={() => handleCompanySelect(company.id)}
                  className="group flex items-center justify-between p-5 hover:bg-blue-50/50 transition-colors duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    
                    {/* Dynamic Company Avatar */}
                    <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-blue-100 group-hover:border-blue-200 transition-colors duration-200">
                      <span className="text-lg font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                        {getInitials(company.name)}
                      </span>
                    </div>

                    {/* Text Details */}
                    <div className="min-w-0">
                      <h3 className="text-[16px] font-bold text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors duration-200 truncate">
                        {company.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                        <Building2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <p className="text-[13px] font-medium truncate">
                          {company.address || "No address details provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Indicator */}
                  <div className="pl-4 shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white border border-slate-200 text-slate-300 group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-md">
                      <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Dialog for Adding Company ── */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-slate-200 rounded-[24px]">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Add New Workspace</DialogTitle>
            <DialogDescription className="text-[14px] font-medium text-slate-500 mt-1">
              Enter the company details below to create a new environment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 pt-4 bg-slate-50 border-t border-slate-100 mt-4">
            <CompanyForm 
              onSuccess={handleCompanyCreated}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CompanySelection;