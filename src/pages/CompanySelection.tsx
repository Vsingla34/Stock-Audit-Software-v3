// src/pages/CompanySelection.tsx
import { useState, useEffect, FormEvent } from "react";
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
import {
  Building2,
  ArrowRight,
  PlusCircle,
  Users,
  MapPin,
  X,
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

interface Location {
  id: string;
  name: string;
  companyId?: string | null;
}

const CompanySelection = () => {
  const navigate = useNavigate();
  const { setSelectedCompanyId } = useCompany();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [newCompanyActive, setNewCompanyActive] = useState(true);
  const [creatingCompany, setCreatingCompany] = useState(false);

  const [showUserForm, setShowUserForm] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRoleForForm, setUserRoleForForm] = useState<
    "admin" | "auditor" | "client"
  >("auditor");
  const [assignedCompanyIds, setAssignedCompanyIds] = useState<string[]>([]);
  const [assignedLocationIds, setAssignedLocationIds] = useState<string[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);

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

      if (profile.role !== "admin" && profile.assigned_companies?.length > 0) {
        companiesQuery = companiesQuery.in("id", profile.assigned_companies);
      }

      const { data: companiesData, error: companiesError } =
        await companiesQuery;
      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("id, name, company_id")
        .eq("active", true)
        .order("name");

      if (locationsError) throw locationsError;

      const mappedLocations: Location[] =
        locationsData?.map((loc) => ({
          id: loc.id,
          name: loc.name,
          companyId: loc.company_id ?? null,
        })) || [];

      setLocations(mappedLocations);
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

  // ---------- Company creation ----------
  const handleCreateCompany = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      setCreatingCompany(true);
      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: newCompanyName.trim(),
          address: newCompanyAddress.trim() || null,
          is_active: newCompanyActive,
        })
        .select("*")
        .single();

      if (error) throw error;

      setCompanies((prev) => [...prev, data as Company]);
      setNewCompanyName("");
      setNewCompanyAddress("");
      setNewCompanyActive(true);
      setShowCompanyForm(false);

      toast.success("Company created successfully");
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error(error.message || "Failed to create company");
    } finally {
      setCreatingCompany(false);
    }
  };

  // ---------- User creation ----------
  const toggleAssignedCompany = (id: string) => {
    setAssignedCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

    setAssignedLocationIds((prev) =>
      prev.filter((locId) => {
        const loc = locations.find((l) => l.id === locId);
        if (!loc?.companyId) return false;
        return prev.includes(loc.companyId) || id === loc.companyId;
      })
    );
  };

  const toggleAssignedLocation = (id: string) => {
    setAssignedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const resetUserForm = () => {
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRoleForForm("auditor");
    setAssignedCompanyIds([]);
    setAssignedLocationIds([]);
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();

    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      toast.error("Name, email and password are required");
      return;
    }

    if (userRoleForForm !== "admin" && assignedCompanyIds.length === 0) {
      toast.error("Please assign at least one company for non-admin users");
      return;
    }

    try {
      setCreatingUser(true);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userEmail.trim(),
        password: userPassword,
        options: {
          data: {
            name: userName.trim(),
            role: userRoleForForm,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert([
            {
              id: authData.user.id,
              email: userEmail.trim(),
              name: userName.trim(),
              role: userRoleForForm,
              assigned_locations:
                assignedLocationIds.length > 0 ? assignedLocationIds : null,
              assigned_companies:
                assignedCompanyIds.length > 0 ? assignedCompanyIds : null,
            },
          ]);

        if (profileError) throw profileError;

        toast.success("User created successfully", {
          description: `${userName} has been added.`,
        });

        resetUserForm();
        setShowUserForm(false);
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user", {
        description: error.message,
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const isAdmin = userRole === "admin";

  if (!loading && companies.length === 0 && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">
              No Companies Available
            </CardTitle>
            <CardDescription className="text-center">
              You do not have access to any companies. Please contact your
              administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const filteredLocations: Location[] =
    assignedCompanyIds.length === 0
      ? []
      : locations.filter(
          (loc) =>
            !!loc.companyId && assignedCompanyIds.includes(loc.companyId)
        );

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

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowCompanyForm((prev) => !prev)}>
                {showCompanyForm ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Close Company Form
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Company
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowUserForm((prev) => !prev)}
              >
                {showUserForm ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Close User Form
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Add User
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Company form */}
        {isAdmin && showCompanyForm && (
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
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. ABC Retail Pvt Ltd"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company-address">Address</Label>
                  <Textarea
                    id="company-address"
                    value={newCompanyAddress}
                    onChange={(e) => setNewCompanyAddress(e.target.value)}
                    placeholder="Registered office address (optional)"
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="company-active"
                    checked={newCompanyActive}
                    onCheckedChange={(checked) =>
                      setNewCompanyActive(!!checked)
                    }
                  />
                  <Label htmlFor="company-active">Active</Label>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={creatingCompany}
                >
                  {creatingCompany ? "Creating..." : "Create Company"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* User form */}
        {isAdmin && showUserForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                New User
              </CardTitle>
              <CardDescription>
                Create a new user and assign companies/locations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleCreateUser}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Name *</Label>
                    <Input
                      id="user-name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email *</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Password *</Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role *</Label>
                    <select
                      id="user-role"
                      className="border rounded-md px-3 py-2 text-sm w-full bg-background"
                      value={userRoleForForm}
                      onChange={(e) =>
                        setUserRoleForForm(
                          e.target.value as "admin" | "auditor" | "client"
                        )
                      }
                    >
                      <option value="admin">Admin</option>
                      <option value="auditor">Auditor</option>
                      <option value="client">Client</option>
                    </select>
                  </div>
                </div>

                {userRoleForForm !== "admin" && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Assign Companies * (Required for non-admin users)
                    </Label>
                    <Card className="p-4 max-h-48 overflow-y-auto">
                      {loading && companies.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Loading companies...
                        </p>
                      ) : companies.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No companies available.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {companies.map((company) => (
                            <div
                              key={company.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`user-company-${company.id}`}
                                checked={assignedCompanyIds.includes(
                                  company.id
                                )}
                                onCheckedChange={() =>
                                  toggleAssignedCompany(company.id)
                                }
                              />
                              <label
                                htmlFor={`user-company-${company.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {company.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Assign Locations (Optional, filtered by selected companies)
                  </Label>
                  <Card className="p-4 max-h-48 overflow-y-auto">
                    {assignedCompanyIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Select at least one company to see its locations.
                      </p>
                    ) : loading && locations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Loading locations...
                      </p>
                    ) : filteredLocations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No locations found for the selected companies.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredLocations.map((location) => (
                          <div
                            key={location.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`user-location-${location.id}`}
                              checked={assignedLocationIds.includes(
                                location.id
                              )}
                              onCheckedChange={() =>
                                toggleAssignedLocation(location.id)
                              }
                            />
                            <label
                              htmlFor={`user-location-${location.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {location.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetUserForm();
                      setShowUserForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creatingUser}>
                    {creatingUser ? "Creating..." : "Create User"}
                  </Button>
                </div>
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
