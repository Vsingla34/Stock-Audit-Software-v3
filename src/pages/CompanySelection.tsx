// src/pages/CompanySelection.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, ArrowRight, PlusCircle, X } from "lucide-react";
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
  const [assignedCompanies, setAssignedCompanies] = useState<string[]>([]);

  // form state (admin only)
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUserAndCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserAndCompanies = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role, assigned_companies")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      setUserRole(profile.role);
      setAssignedCompanies(profile.assigned_companies || []);

      // Base query: active companies
      let query = supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");

      // Non-admin: restrict to assigned companies
      if (profile.role !== "admin" && profile.assigned_companies?.length > 0) {
        query = query.in("id", profile.assigned_companies);
      }

      const { data: companiesData, error: companiesError } = await query;

      if (companiesError) throw companiesError;

      setCompanies(companiesData || []);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
    navigate("/");
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      setCreating(true);

      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: newName.trim(),
          address: newAddress.trim() || null,
          is_active: newIsActive,
        })
        .select("*")
        .single();

      if (error) throw error;

      setCompanies((prev) => [...prev, data as Company]);
      setNewName("");
      setNewAddress("");
      setNewIsActive(true);
      setShowForm(false);

      toast.success("Company created successfully");
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error(error.message || "Failed to create company");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      </div>
    );
  }

  const isAdmin = userRole === "admin";

  if (companies.length === 0 && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">No Companies Available</CardTitle>
            <CardDescription className="text-center">
              You do not have access to any companies. Please contact your
              administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-6xl w-full space-y-6">
        {/* Header with title + Add Company button on top-right */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
            <p className="text-muted-foreground">
              Select a company to continue. All dashboards and inventory data
              will be filtered by your selection.
            </p>
          </div>

          {isAdmin && (
            <Button onClick={() => setShowForm((prev) => !prev)}>
              {showForm ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Close Form
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Company
                </>
              )}
            </Button>
          )}
        </div>

        {/* Add Company form (only when toggled) */}
        {isAdmin && showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                New Company
              </CardTitle>
              <CardDescription>
                Create a new company to be used in audits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleCreateCompany}>
                <div className="space-y-1">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. ABC Retail Pvt Ltd"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="company-address">Address</Label>
                  <Textarea
                    id="company-address"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Registered office address (optional)"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="company-active"
                    checked={newIsActive}
                    onCheckedChange={(checked) => setNewIsActive(!!checked)}
                  />
                  <Label htmlFor="company-active">Active</Label>
                </div>

                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? "Creating..." : "Create Company"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

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
                      <CardTitle className="text-lg">
                        {company.name}
                      </CardTitle>
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

          {companies.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>No companies found</CardTitle>
                <CardDescription>
                  {isAdmin
                    ? "Create the first company using the Add Company button above."
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
