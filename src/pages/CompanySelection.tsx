
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
  Building2,
  ArrowRight,
  PlusCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";

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

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // ✅ Modified: Only Super Admin sees all companies.
      // Admin, Auditor, Client see only assigned companies.
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
      /* ignore */
    }
    navigate("/");
  };

  const isSuperAdmin = userRole === "super_admin";

  if (!loading && companies.length === 0 && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">
              No Companies Available
            </CardTitle>
            <CardDescription className="text-center">
              You have not been assigned to any companies. Please contact the Super Administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-6xl w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
            <p className="text-muted-foreground">
              Select a company to continue. All dashboards and inventory data
              will be filtered by your selection.
            </p>
          </div>

          {/* ✅ Only Super Admin sees Add Company button */}
          {isSuperAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/add-company")}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Manage Companies
              </Button>
            </div>
          )}
        </div>

        {/* Company grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="cursor-pointer transition hover:border-primary hover:shadow-md"
              onClick={() => handleCompanySelect(company.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{company.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {company.address || "No address provided"}
                      </CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
            </Card>
          ))}

          {!loading && companies.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>No companies found</CardTitle>
                <CardDescription>
                  {isSuperAdmin
                    ? "Create the first company using the Manage Companies button."
                    : "Please contact your administrator."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanySelection;
